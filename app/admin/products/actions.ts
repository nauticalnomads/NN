"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { autoQueueForProduct } from "@/lib/blog";
import { generateSeo } from "@/lib/seo";
import {
  printfulConfigured,
  listSyncProducts,
  getSyncProduct,
  resolveStoreId,
} from "@/lib/printful";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 70) || "product"
  );
}

// Import sync products from Printful into the catalogue. Idempotent &
// non-destructive: only creates products not already mapped (by
// provider_product_id); imported products land as drafts for review. Pass a
// single sync product id, or leave blank to import all new ones.
export async function importFromPrintful(formData: FormData): Promise<void> {
  await requireStaff();
  if (!printfulConfigured()) redirect("/admin/products/import?error=nokey");
  const single = String(formData.get("sync_id") || "").trim();
  const sb = createServiceClient();

  let outcome: { created: number; skipped: number; variants: number } | { error: string };
  try {
    const storeId = (await resolveStoreId()) ?? undefined;
    const ids = single ? [single] : (await listSyncProducts(storeId)).map((p) => String(p.id));
    let created = 0,
      skipped = 0,
      variants = 0;
    for (const id of ids) {
      const { data: ex } = await sb
        .from("products")
        .select("id")
        .eq("provider", "printful")
        .eq("provider_product_id", id)
        .maybeSingle();
      if (ex) {
        skipped++;
        continue;
      }
      const detail = await getSyncProduct(id, storeId);
      const sp = detail.sync_product;
      const svs = detail.sync_variants ?? [];
      if (!sp || svs.length === 0) {
        skipped++;
        continue;
      }
      const prices = svs
        .map((v) => Number(v.retail_price))
        .filter((n) => Number.isFinite(n) && n > 0);
      const price = prices.length ? Math.min(...prices) : 0;
      const currency = svs[0].currency || "GBP";
      const image =
        sp.thumbnail_url ||
        svs.find((v) => v.product?.image)?.product?.image ||
        svs.flatMap((v) => v.files ?? []).find((f) => f.preview_url)?.preview_url ||
        null;
      const { data: prod, error } = await sb
        .from("products")
        .insert({
          title: sp.name,
          slug: `${slugify(sp.name)}-${String(sp.id).slice(-5)}`,
          status: "draft",
          price,
          currency,
          provider: "printful",
          provider_product_id: String(sp.id),
          source: "printful",
          source_id: String(sp.id),
        } as never)
        .select("id")
        .single();
      if (error || !prod) {
        skipped++;
        continue;
      }
      const pid = (prod as unknown as { id: string }).id;
      const vrows = svs.map((v, i) => ({
        product_id: pid,
        title:
          (v.name || "")
            .replace(sp.name, "")
            .replace(/^[\s\-/|]+/, "")
            .trim() ||
          v.name ||
          `Variant ${i + 1}`,
        sku: v.sku || null,
        provider_variant_id: String(v.id),
        price: Number(v.retail_price) || price,
        sort_order: i,
      }));
      await sb.from("variants").insert(vrows as never);
      variants += vrows.length;
      if (image) {
        await sb.from("product_images").insert({
          product_id: pid,
          url: image,
          alt: sp.name,
          sort_order: 0,
          is_primary: true,
        } as never);
      }
      created++;
    }
    outcome = { created, skipped, variants };
  } catch (e) {
    outcome = { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/admin/products");
  if ("error" in outcome) {
    redirect(`/admin/products/import?error=${encodeURIComponent(outcome.error.slice(0, 140))}`);
  }
  redirect(
    `/admin/products/import?created=${outcome.created}&skipped=${outcome.skipped}&variants=${outcome.variants}`,
  );
}

// AI-fill SEO title + description for a single product.
export async function generateProductSeo(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("product_id") || "");
  if (!id) return;
  const sb = createServiceClient();
  const { data } = await sb
    .from("products")
    .select("title, description, category_slug")
    .eq("id", id)
    .maybeSingle();
  const p = data as unknown as {
    title: string;
    description: string | null;
    category_slug: string | null;
  } | null;
  if (!p) return;
  const seo = await generateSeo({
    label: p.title,
    kind: "product",
    context: [p.category_slug, p.description?.slice(0, 200)].filter(Boolean).join(" — "),
  });
  await sb
    .from("products")
    .update(seo as never)
    .eq("id", id);
  revalidatePath(`/admin/products/${id}`);
}

// Publish or unpublish a product. On a draft → published transition we auto-queue
// a blog draft (§B-13). De-dup lives in autoQueueForProduct. Content admin may
// manage products (permission matrix §3) so requireStaff is correct here.
export async function setProductStatus(formData: FormData): Promise<void> {
  await requireStaff();
  const productId = String(formData.get("product_id") || "");
  const next = String(formData.get("status") || "");
  if (!productId || (next !== "published" && next !== "draft")) return;

  const sb = createServiceClient();
  const { data: current } = await sb
    .from("products")
    .select("status")
    .eq("id", productId)
    .maybeSingle();
  const wasStatus = (current as unknown as { status: string } | null)?.status;

  await sb
    .from("products")
    .update({ status: next } as never)
    .eq("id", productId);

  // Trigger the blog auto-queue only on a real draft → published transition.
  if (next === "published" && wasStatus !== "published") {
    autoQueueForProduct(productId, "auto_new_product").catch(() => undefined);
  }

  revalidatePath("/admin/products");
}

// Set a product's category from the products list dropdown. Updates
// category_slug + gender, and re-links the product to that collection and all
// its ancestors (so every level's collection page populates). Replaces any
// previous category links so the choice is authoritative.
export async function setProductCategory(formData: FormData): Promise<void> {
  await requireStaff();
  const productId = String(formData.get("product_id") || "");
  const categorySlug = String(formData.get("category_slug") || "").trim();
  if (!productId) return;
  const sb = createServiceClient();

  if (!categorySlug) {
    await sb.from("collection_products").delete().eq("product_id", productId);
    await sb
      .from("products")
      .update({ category_slug: null } as never)
      .eq("id", productId);
    revalidatePath("/admin/products");
    return;
  }

  const { data: cols } = await sb.from("collections").select("id, slug, parent_slug, gender");
  const all =
    (cols as unknown as {
      id: string;
      slug: string;
      parent_slug: string | null;
      gender: string | null;
    }[]) ?? [];
  const bySlug = Object.fromEntries(all.map((c) => [c.slug, c]));
  const target = bySlug[categorySlug];
  if (!target) return;

  const chain: string[] = [];
  let cur: string | null = categorySlug;
  while (cur && bySlug[cur]) {
    chain.push(bySlug[cur].id);
    cur = bySlug[cur].parent_slug;
  }

  await sb
    .from("products")
    .update({ category_slug: categorySlug, gender: target.gender } as never)
    .eq("id", productId);
  await sb.from("collection_products").delete().eq("product_id", productId);
  await sb
    .from("collection_products")
    .upsert(chain.map((collection_id) => ({ collection_id, product_id: productId })) as never, {
      onConflict: "collection_id,product_id",
    });

  revalidatePath("/admin/products");
  revalidatePath("/admin/collections");
}

// Edit a product's price/sale/status/SEO from /admin/products/[id]. Fires the
// blog auto-queue on a draft→published transition and on a newly-on-sale
// transition (price drops below compare_at_price). De-dup lives in lib/blog.
export async function updateProduct(formData: FormData): Promise<void> {
  await requireStaff();
  const productId = String(formData.get("product_id") || "");
  if (!productId) return;

  const sb = createServiceClient();
  const { data: current } = await sb
    .from("products")
    .select("status, price, compare_at_price")
    .eq("id", productId)
    .maybeSingle();
  const old = current as unknown as {
    status: string;
    price: number;
    compare_at_price: number | null;
  } | null;
  if (!old) return;

  const price = Number(formData.get("price"));
  const compareRaw = String(formData.get("compare_at_price") || "").trim();
  const compare_at_price = compareRaw === "" ? null : Number(compareRaw);
  const status = String(formData.get("status") || old.status);
  const featured = formData.get("featured") === "on";
  const seo_title = String(formData.get("seo_title") || "").trim() || null;
  const seo_description = String(formData.get("seo_description") || "").trim() || null;

  // Guard against bad numeric input — leave price untouched if invalid.
  const safePrice = Number.isFinite(price) && price >= 0 ? price : old.price;
  const safeCompare =
    compare_at_price === null || (Number.isFinite(compare_at_price) && compare_at_price >= 0)
      ? compare_at_price
      : old.compare_at_price;

  await sb
    .from("products")
    .update({
      price: safePrice,
      compare_at_price: safeCompare,
      status: status === "published" ? "published" : "draft",
      featured,
      seo_title,
      seo_description,
    } as never)
    .eq("id", productId);

  const wasOnSale = old.compare_at_price != null && old.price < old.compare_at_price;
  const nowOnSale = safeCompare != null && safePrice < safeCompare;

  if (status === "published" && old.status !== "published") {
    autoQueueForProduct(productId, "auto_new_product").catch(() => undefined);
  } else if (nowOnSale && !wasOnSale) {
    // Only when it newly goes on sale (de-dup is a backstop).
    autoQueueForProduct(productId, "auto_on_sale").catch(() => undefined);
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
}
