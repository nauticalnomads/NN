import { after } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { autoFulfilOrder } from "@/lib/fulfilment";
import { sendOrderConfirmation } from "@/lib/email";

// Idempotently flip an order to `paid` and fire the one-time side effects
// (confirmation email + auto-fulfilment). Safe to call from BOTH the Stripe
// webhook and the order-confirmation page fallback: the side effects only run
// on the actual transition into `paid` (gated by the row the UPDATE returns),
// so a second call — or a webhook/redirect race — is a no-op. Postgres row
// locking serialises concurrent updates, so exactly one caller wins.
export async function markOrderPaid(
  orderId: string,
  paymentIntentId: string | null,
): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("orders")
    .update({
      status: "paid",
      placed_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
    } as never)
    .eq("id", orderId)
    .neq("status", "paid") // idempotency: don't re-fire on an already-paid order
    .select("id");

  const transitioned = Array.isArray(data) && data.length > 0;
  if (!transitioned) return false;

  // Run the one-time side effects (receipt email + auto-fulfilment) AFTER the
  // response is sent, via `after()` → the Workers waitUntil keeps the isolate
  // alive until they settle. Plain fire-and-forget can be killed mid-flight on
  // Workers, dropping emails/fulfilment. `after` outside a request scope throws,
  // so fall back to a detached run (e.g. scripts/tests).
  const runSideEffects = async () => {
    await sendOrderConfirmation(orderId).catch((e) => console.error("confirmation email:", e));
    await autoFulfilOrder(orderId).catch((e) => console.error("auto-fulfil:", e));
  };
  try {
    after(runSideEffects);
  } catch {
    void runSideEffects();
  }
  return true;
}

// Fallback confirmation used by the order page: the webhook is the primary path
// (and handles async payment methods), but if it's slow or not yet configured,
// verify the Checkout Session directly on return and mark the order paid. The
// `metadata.order_id` check stops a caller passing someone else's session id.
export async function confirmOrderFromSession(
  orderId: string,
  sessionId: string,
): Promise<boolean> {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.order_id !== orderId) return false;
    if (session.payment_status !== "paid") return false;
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
    return await markOrderPaid(orderId, pi);
  } catch (e) {
    console.error("confirmOrderFromSession failed:", e);
    return false;
  }
}
