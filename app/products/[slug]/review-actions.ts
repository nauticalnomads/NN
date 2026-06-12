"use server";

import { revalidatePath } from "next/cache";
import { createReview } from "@/lib/reviews";
import { getCustomer } from "@/lib/customer";

// Auth state for the review form, fetched client-side so the PDP itself stays
// statically rendered (calling cookies() in the page would force it dynamic).
export async function reviewAuthState(): Promise<{ signedIn: boolean; defaultName: string }> {
  const customer = await getCustomer();
  return { signedIn: !!customer, defaultName: customer?.full_name ?? "" };
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
