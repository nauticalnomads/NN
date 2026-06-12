"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { setReviewStatus } from "@/lib/reviews";

// Moderate a review. Staff-gated. Revalidates the product page so a newly
// published (or hidden) review shows up without waiting for ISR.
export async function moderateReview(formData: FormData): Promise<void> {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id || (status !== "published" && status !== "rejected" && status !== "pending")) return;
  await setReviewStatus(id, status);
  if (slug) revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/reviews");
}
