"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { autoQueueForProduct } from "@/lib/blog";

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
