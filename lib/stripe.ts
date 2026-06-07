import Stripe from "stripe";

// Server-only Stripe client. Reuses one instance across hot reloads.
let cached: Stripe | null = null;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!cached) {
    // We run on Cloudflare Workers (OpenNext), which has no Node http stack, so
    // the SDK's default transport fails with "An error occurred with our
    // connection to Stripe". Route requests through the platform fetch instead.
    cached = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  }
  return cached;
}
