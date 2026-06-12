"use server";

import { revalidatePath } from "next/cache";
import { createReview, canReviewProduct } from "@/lib/reviews";

// Review eligibility for a product, fetched client-side so the PDP itself stays
// statically rendered (calling cookies() in the page would force it dynamic).
// Verified buyers only — `canReview` is true only for signed-in customers with a
// paid order containing this product who haven't already reviewed it.
export async function reviewAuthState(
  productId: string,
): Promise<{ signedIn: boolean; canReview: boolean; defaultName: string }> {
  return canReviewProduct(productId);
}

// Submit a product review (signed-in customers only; enforced in createReview).
// Returns a friendly result the form renders inline. Revalidates the PDP so a
// later-approved review shows without a manual cache bust.
export async function submitReviewAction(input: {
  productId: string;
  slug: string;
  rating: number;
  title?: string;
  body: string;
  authorName?: string;
}): Promise<{ ok: boolean; message: string }> {
  const result = await createReview(input);
  if (result.ok) revalidatePath(`/products/${input.slug}`);
  return result;
}
