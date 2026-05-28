import Stripe from "stripe";

// Server-only Stripe client. Reuses one instance across hot reloads.
let cached: Stripe | null = null;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  // Pin to the SDK's bundled version so node-stripe types stay in lockstep.
  if (!cached) cached = new Stripe(key);
  return cached;
}
