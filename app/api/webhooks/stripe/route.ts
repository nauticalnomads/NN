import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { autoFulfilOrder } from "@/lib/fulfilment";
import { sendOrderConfirmation } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";

// Trust the WEBHOOK, not the redirect — Stripe Checkout's success_url can be
// reached without paying (e.g. browser back). We only flip status to 'paid'
// here. Idempotent: applying the same event twice is a no-op (status check).
export const runtime = "nodejs"; // raw body needed for signature verification

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature: ${err instanceof Error ? err.message : "invalid"}` },
      { status: 400 },
    );
  }

  const sb = createServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.order_id;
        if (!orderId) break;
        await sb
          .from("orders")
          .update({
            status: "paid",
            placed_at: new Date().toISOString(),
            stripe_payment_intent_id:
              typeof s.payment_intent === "string" ? s.payment_intent : null,
          } as never)
          .eq("id", orderId)
          .neq("status", "paid"); // idempotency: don't downgrade
        // Fire-and-forget: confirmation email + auto-fulfilment trigger.
        sendOrderConfirmation(orderId).catch((e) => console.error("confirmation email:", e));
        autoFulfilOrder(orderId).catch((e) => console.error("auto-fulfil:", e));
        break;
      }
      case "charge.refunded":
      case "refund.updated": {
        // Session 10 (refunds) processes these against the refunds table.
        // Acknowledged here so Stripe doesn't keep retrying.
        break;
      }
      case "charge.dispute.created": {
        const d = event.data.object as Stripe.Dispute;
        const orderId = (d.metadata as Record<string, string> | null)?.order_id;
        if (orderId) {
          const detail = `Order ${orderId}: ${d.reason} — ${d.amount / 100} ${d.currency}`;
          await sb.from("notifications").insert({
            type: "dispute_opened",
            title: "Stripe dispute opened",
            body: detail,
            order_id: orderId,
          } as never);
          await notifyOwner("dispute_opened", "Stripe dispute opened", detail).catch(
            () => undefined,
          );
        }
        break;
      }
    }
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
