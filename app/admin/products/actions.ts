"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";
import { autoQueueForProduct } from "@/lib/blog";
import { generateSeo } from "@/lib/seo";
import { uploadImage } from "@/lib/storage";
import { printfulConfigured, listSyncProducts, resolveStoreId } from "@/lib/printful";
import { importPrintfulProduct } from "@/lib/printful-import";

// Import sync products from Printful into the catalogue. Idempotent &
// non-destructive: only creates products not already mapped (by
// provider_product_id); imported products land as drafts for review. Pass a
// single sync product id, or leave blank to import all new ones.
export async function importFromPrintful(formData: FormData): Promise<void> {
  await requireStaff();
  if (!(await printfulConfigured())) redirect("/admin/products/import?error=nokey");
  const single = String(formData.get("sync_id") || "").trim();
  const sb = createServiceClient();

  // Cloudflare caps subrequests per invocation, so import new products in
  // capped batches (each new product = a Printful fetch + a few DB writes).
  // Already-imported ids are filtered in-memory from a single query — no
  // per-product lookup. Re-run to continue (idempotent: skips existing).
  const MAX_PER_RUN = 8;

  let outcome:
    | { created: number; skipped: number; failed: number; remaining: number }
    | { error: string };
  try {
    const storeId = (await resolveStoreId()) ?? undefined;

    // Single product (pasted id or "Import" button from the list).
    if (single) {
      const r = await importPrintfulProduct(sb, single, storeId);
      revalidatePath("/admin/products");
      if (r === "created") redirect(`/admin/products/import?created=1&skipped=0&remaining=0`);
      if (r === "exists") redirect(`/admin/products/import?created=0&skipped=1&remaining=0`);
      redirect(
        `/admin/products/import?error=${encodeURIComponent(
          `No Printful sync product found for "${single}". Use the Sync Product ID (the number in the product's Printful URL) or its external/Shopify ID — or just pick from the list below.`,
        )}`,
      );
    }

    const allIds = (await listSyncProducts(storeId)).map((p) => String(p.id));
    const { data: existRows } = await sb
      .from("products")
      .select("provider_product_id")
      .eq("provider", "printful");
    const have = new Set(
      ((existRows as unknown as { provider_product_id: string | null }[]) ?? []).map((r) =>
        String(r.provider_product_id),
      ),
    );
    const newIds = allIds.filter((id) => !have.has(id));
    const batch = newIds.slice(0, MAX_PER_RUN);
    let created = 0,
      failed = 0;
    for (const id of batch) {
      const r = await importPrintfulProduct(sb, id, storeId);
      if (r === "created") created++;
      else if (r !== "exists") failed++;
    }
    outcome = {
      created,
      skipped: allIds.length - newIds.length,
      failed,
      remaining: newIds.length - batch.length,
    };
  } catch (e) {
    outcome = { error: e instanceof Error ? e.message : String(e) };
  }

  revalidatePath("/admin/products");
  if ("error" in outcome) {
    redirect(`/admin/products/import?error=${encodeURIComponent(outcome.error.slice(0, 200))}`);
  }
  redirect(
    `/admin/products/import?created=${outcome.created}&skipped=${outcome.skipped}&failed=${outcome.failed}&remaining=${outcome.remaining}`,
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
  const actor = await requireStaff();
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
  if (wasStatus !== next) {
    await writeAudit(actor, "product.status", { product_id: productId, from: wasStatus, to: next });
  }

  // Trigger the blog auto-queue only on a real draft → published transition.
  if (next === "published" && wasStatus !== "published") {
    autoQueueForProduct(productId, "auto_new_product").catch(() => undefined);
  }

  revalidatePath("/admin/products");
}

// Bulk publish/unpublish from the products list (checkbox selection). Fires the
// blog auto-queue per newly-published product, same as the single-row action.
export async function bulkSetProductStatus(formData: FormData): Promise<void> {
  const actor = await requireStaff();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const next = String(formData.get("status") || "");
  if (!ids.length || (next !== "published" && next !== "draft")) {
    redirect("/admin/products?notice=none");
  }

  const sb = createServiceClient();
  const { data: before } = await sb.from("products").select("id, status").in("id", ids);
  const wasPublished = new Set(
    (((before as unknown as { id: string; status: string }[]) ?? []) || [])
      .filter((p) => p.status === "published")
      .map((p) => p.id),
  );

  const { error } = await sb
    .from("products")
    .update({ status: next } as never)
    .in("id", ids);
  if (error) redirect("/admin/products?notice=error");

  await writeAudit(actor, "product.bulk_status", { product_ids: ids, to: next });
  if (next === "published") {
    for (const id of ids) {
      if (!wasPublished.has(id)) autoQueueForProduct(id, "auto_new_product").catch(() => undefined);
    }
  }

  revalidatePath("/admin/products");
  redirect(`/admin/products?notice=${next}:${ids.length}`);
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

  // products.gender has a CHECK constraint (men/women/unisex) — collections use
  // "accessories", which isn't valid here, so map non-gendered categories to
  // "unisex". Without this the whole update fails and the category never saves.
  const productGender =
    target.gender === "men" || target.gender === "women" ? target.gender : "unisex";
  await sb
    .from("products")
    .update({ category_slug: categorySlug, gender: productGender } as never)
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
  const actor = await requireStaff();
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
  const description = String(formData.get("description") || "").trim() || null;

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
      description,
    } as never)
    .eq("id", productId);

  // Audit the sensitive edits: price and status changes (who, from → to).
  if (safePrice !== old.price) {
    await writeAudit(actor, "product.price", {
      product_id: productId,
      from: old.price,
      to: safePrice,
    });
  }
  const nextStatus = status === "published" ? "published" : "draft";
  if (nextStatus !== old.status) {
    await writeAudit(actor, "product.status", {
      product_id: productId,
      from: old.status,
      to: nextStatus,
    });
  }

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

// ── Product images ───────────────────────────────────────────────────────────
async function productSlug(sb: ReturnType<typeof createServiceClient>, productId: string) {
  const { data } = await sb.from("products").select("slug").eq("id", productId).maybeSingle();
  return (data as unknown as { slug?: string } | null)?.slug;
}
function revalImages(slug: string | undefined, productId: string) {
  revalidatePath(`/admin/products/${productId}`);
  if (slug) revalidatePath(`/products/${slug}`);
}

// Upload one or more photos for a product (appended to the end of the gallery).
export async function addProductImages(formData: FormData): Promise<void> {
  await requireStaff();
  const productId = String(formData.get("product_id") || "");
  if (!productId) return;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return;
  const sb = createServiceClient();
  const { data: prod } = await sb
    .from("products")
    .select("title, slug")
    .eq("id", productId)
    .maybeSingle();
  const title = (prod as unknown as { title?: string } | null)?.title ?? "";
  const { data: imgs } = await sb
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId);
  const existing = (imgs as unknown as { sort_order: number }[]) ?? [];
  let nextSort = existing.length ? Math.max(...existing.map((i) => i.sort_order ?? 0)) + 1 : 0;
  const hadNone = existing.length === 0;
  for (let k = 0; k < files.length; k++) {
    const url = await uploadImage(files[k], `products/${productId}`);
    if (!url) continue;
    await sb.from("product_images").insert({
      product_id: productId,
      url,
      alt: title,
      sort_order: nextSort,
      is_primary: hadNone && k === 0,
    } as never);
    nextSort++;
  }
  revalImages((prod as unknown as { slug?: string } | null)?.slug, productId);
}

// Swap a photo with its neighbour (reorder up/down).
export async function moveProductImage(formData: FormData): Promise<void> {
  await requireStaff();
  const imageId = String(formData.get("image_id") || "");
  const dir = String(formData.get("dir") || "");
  if (!imageId) return;
  const sb = createServiceClient();
  const { data: img } = await sb
    .from("product_images")
    .select("id, product_id, sort_order")
    .eq("id", imageId)
    .maybeSingle();
  const cur = img as unknown as { id: string; product_id: string; sort_order: number } | null;
  if (!cur) return;
  const { data: sibs } = await sb
    .from("product_images")
    .select("id, sort_order")
    .eq("product_id", cur.product_id)
    .order("sort_order", { ascending: true });
  const list = (sibs as unknown as { id: string; sort_order: number }[]) ?? [];
  const idx = list.findIndex((x) => x.id === imageId);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= list.length) return;
  const other = list[swap];
  await sb
    .from("product_images")
    .update({ sort_order: other.sort_order } as never)
    .eq("id", cur.id);
  await sb
    .from("product_images")
    .update({ sort_order: cur.sort_order } as never)
    .eq("id", other.id);
  revalImages(await productSlug(sb, cur.product_id), cur.product_id);
}

// Make a photo the primary (main) image.
export async function setPrimaryProductImage(formData: FormData): Promise<void> {
  await requireStaff();
  const imageId = String(formData.get("image_id") || "");
  if (!imageId) return;
  const sb = createServiceClient();
  const { data: img } = await sb
    .from("product_images")
    .select("product_id")
    .eq("id", imageId)
    .maybeSingle();
  const productId = (img as unknown as { product_id?: string } | null)?.product_id;
  if (!productId) return;
  await sb
    .from("product_images")
    .update({ is_primary: false } as never)
    .eq("product_id", productId);
  await sb
    .from("product_images")
    .update({ is_primary: true } as never)
    .eq("id", imageId);
  revalImages(await productSlug(sb, productId), productId);
}

// Delete a photo. If it was primary, promote the next one.
export async function deleteProductImage(formData: FormData): Promise<void> {
  await requireStaff();
  const imageId = String(formData.get("image_id") || "");
  if (!imageId) return;
  const sb = createServiceClient();
  const { data: img } = await sb
    .from("product_images")
    .select("product_id, is_primary")
    .eq("id", imageId)
    .maybeSingle();
  const cur = img as unknown as { product_id: string; is_primary: boolean } | null;
  if (!cur) return;
  await sb.from("product_images").delete().eq("id", imageId);
  if (cur.is_primary) {
    const { data: next } = await sb
      .from("product_images")
      .select("id")
      .eq("product_id", cur.product_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    const nextId = (next as unknown as { id?: string } | null)?.id;
    if (nextId)
      await sb
        .from("product_images")
        .update({ is_primary: true } as never)
        .eq("id", nextId);
  }
  revalImages(await productSlug(sb, cur.product_id), cur.product_id);
}
