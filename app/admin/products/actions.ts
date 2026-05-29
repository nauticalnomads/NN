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
