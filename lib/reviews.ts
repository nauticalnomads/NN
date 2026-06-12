// Product reviews domain logic. Storefront reads go through the anon client
// (RLS returns only `published` rows). Submission + admin moderation use the
// service client. Everything degrades to empty/no-op if the product_reviews
// migration hasn't been run yet, so pages never break.
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { getCustomer } from "@/lib/customer";

export type Review = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  verified_purchase: boolean;
  created_at: string;
};

export type ReviewSummary = { count: number; average: number };

// Order statuses that count as a completed purchase (for the verified badge).
const PAID_STATUSES = ["paid", "awaiting_fulfilment", "fulfilling", "shipped", "delivered"];

// Published reviews for a product, newest first.
export async function getProductReviews(productId: string): Promise<Review[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("product_reviews")
      .select("id, product_id, author_name, rating, title, body, verified_purchase, created_at")
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data as unknown as Review[]) ?? [];
  } catch {
    return [];
  }
}

// Count + average rounded to one decimal, derived from a review list.
export function summarizeReviews(reviews: Review[]): ReviewSummary {
  if (!reviews.length) return { count: 0, average: 0 };
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return { count: reviews.length, average: Math.round((sum / reviews.length) * 10) / 10 };
}

// Has this customer a paid order containing the product? Drives both the
// "verified buyer" gate on submission and the badge.
async function hasPurchased(customerId: string, productId: string): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("order_items")
      .select("id, orders!inner(customer_id, status)")
      .eq("product_id", productId)
      .eq("orders.customer_id", customerId)
      .in("orders.status", PAID_STATUSES)
      .limit(1);
    return !!(data as unknown as unknown[])?.length;
  } catch {
    return false;
  }
}

// Can the signed-in customer review this product right now? (Signed in + has a
// paid order with it + hasn't already reviewed it.) Used by the PDP to decide
// whether to show the write-a-review form.
export async function canReviewProduct(
  productId: string,
): Promise<{ signedIn: boolean; canReview: boolean; defaultName: string }> {
  const customer = await getCustomer();
  if (!customer) return { signedIn: false, canReview: false, defaultName: "" };
  const defaultName = customer.full_name ?? "";
  try {
    const svc = createServiceClient();
    const { data: existing } = await svc
      .from("product_reviews")
      .select("id")
      .eq("product_id", productId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (existing) return { signedIn: true, canReview: false, defaultName };
  } catch {
    /* fall through — treat as not-yet-reviewed */
  }
  const purchased = await hasPurchased(customer.id, productId);
  return { signedIn: true, canReview: purchased, defaultName };
}

// Submit a review for the signed-in customer. Verified buyers only: the customer
// must have a paid order containing the product. Lands as `pending` for
// moderation.
export async function createReview(input: {
  productId: string;
  rating: number;
  title?: string;
  body: string;
  authorName?: string;
}): Promise<{ ok: boolean; message: string }> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, message: "Please sign in to write a review." };

  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) return { ok: false, message: "Choose a rating from 1 to 5." };
  const body = (input.body ?? "").trim();
  if (body.length < 3) return { ok: false, message: "Please write a few words about the product." };
  const author =
    (input.authorName ?? "").trim() ||
    customer.full_name ||
    customer.email.split("@")[0] ||
    "Verified customer";

  const svc = createServiceClient();
  try {
    // One review per customer per product.
    const { data: existing } = await svc
      .from("product_reviews")
      .select("id")
      .eq("product_id", input.productId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (existing) return { ok: false, message: "You've already reviewed this product." };

    // Verified buyers only.
    const verified = await hasPurchased(customer.id, input.productId);
    if (!verified) {
      return { ok: false, message: "Only verified buyers can review this product." };
    }

    const { error } = await svc.from("product_reviews").insert({
      product_id: input.productId,
      customer_id: customer.id,
      author_name: author,
      rating,
      title: (input.title ?? "").trim() || null,
      body,
      status: "pending",
      verified_purchase: true,
    } as never);
    if (error) return { ok: false, message: "Couldn't save your review. Please try again." };
    return { ok: true, message: "Thanks! Your review will appear once it's approved." };
  } catch {
    return { ok: false, message: "Couldn't save your review. Please try again." };
  }
}

export type AdminReview = {
  id: string;
  product_id: string;
  product_title: string | null;
  product_slug: string | null;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: string;
  verified_purchase: boolean;
  created_at: string;
};

// All reviews (any status) for the moderation queue, newest first.
export async function adminListReviews(): Promise<AdminReview[]> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("product_reviews")
      .select(
        "id, product_id, author_name, rating, title, body, status, verified_purchase, created_at, products(title, slug)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    return (
      (data as unknown as (Omit<AdminReview, "product_title" | "product_slug"> & {
        products: { title: string; slug: string } | null;
      })[]) ?? []
    ).map((r) => ({
      ...r,
      product_title: r.products?.title ?? null,
      product_slug: r.products?.slug ?? null,
    }));
  } catch {
    return [];
  }
}

export async function setReviewStatus(
  id: string,
  status: "published" | "rejected" | "pending",
): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { error } = await svc
      .from("product_reviews")
      .update({ status } as never)
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
