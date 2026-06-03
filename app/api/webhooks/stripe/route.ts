import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { autoFulfilOrder } from "@/lib/fulfilment";
import { sendOrderConfirmation, sendRefundUpdate } from "@/lib/email";
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
      case "charge.refunded": {
        // A charge had a refund applied — may come from our admin action or a
        // refund issued directly in the Stripe dashboard. Find the order by
        // payment_intent and mark any matching requested/processing refund as
        // completed. Idempotent: already-completed rows are left alone.
        const charge = event.data.object as Stripe.Charge;
        const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (!pi) break;
        const { data: orderData } = await sb
          .from("orders")
          .select("id, email, currency")
          .eq("stripe_payment_intent_id", pi)
          .maybeSingle();
        const ord = orderData as unknown as {
          id: string;
          email: string;
          currency: string;
        } | null;
        if (!ord) break;

        // Collect the Stripe refund objects on this charge.
        const stripeRefunds = (charge.refunds?.data ?? []) as Stripe.Refund[];
        for (const sr of stripeRefunds) {
          if (sr.status !== "succeeded") continue;
          const amountGbp = sr.amount / 100;
          // Find an open local refund for this order that we haven't reconciled yet.
          const { data: localRefund } = await sb
            .from("refunds")
            .select("id, status, amount, currency")
            .eq("order_id", ord.id)
            .not("status", "in", '("completed","rejected")')
            .order("created_at")
            .limit(1)
            .maybeSingle();
          const lr = localRefund as unknown as {
            id: string;
            status: string;
            amount: number;
            currency: string;
          } | null;
          if (lr) {
            await sb
              .from("refunds")
              .update({
                status: "completed",
                stripe_refund_id: sr.id,
              } as never)
              .eq("id", lr.id);
            await sb
              .from("orders")
              .update({ status: "refunded" } as never)
              .eq("id", ord.id);
            sendRefundUpdate(ord.id, "completed", amountGbp, sr.currency).catch(() => undefined);
          } else {
            // No pending local row — refund was initiated in Stripe dashboard.
            // Insert a reconciliation record so it's visible in admin.
            await sb.from("refunds").insert({
              order_id: ord.id,
              amount: amountGbp,
              currency: sr.currency,
              status: "completed",
              stripe_refund_id: sr.id,
              reason: "refund via stripe dashboard",
            } as never);
            await sb
              .from("orders")
              .update({ status: "refunded" } as never)
              .eq("id", ord.id);
          }
        }
        break;
      }
      case "refund.updated": {
        // Stripe refund status changed (e.g. pending → succeeded, or failed).
        // Update the matching local refunds row by stripe_refund_id.
        const sr = event.data.object as Stripe.Refund;
        if (!sr.id) break;
        // Map Stripe refund status to our enum.
        const statusMap: Record<string, string> = {
          succeeded: "completed",
          failed: "failed",
          canceled: "rejected",
          pending: "processing",
          requires_action: "processing",
        };
        const newStatus = statusMap[sr.status ?? ""] ?? null;
        if (!newStatus) break;
        // Don't downgrade an already-completed row.
        const { data: existing } = await sb
          .from("refunds")
          .select("id, status, order_id, amount, currency")
          .eq("stripe_refund_id", sr.id)
          .maybeSingle();
        const ex = existing as unknown as {
          id: string;
          status: string;
          order_id: string;
          amount: number;
          currency: string;
        } | null;
        if (!ex || ex.status === "completed" || ex.status === "rejected") break;
        await sb
          .from("refunds")
          .update({ status: newStatus } as never)
          .eq("id", ex.id);
        if (newStatus === "completed") {
          await sb
            .from("orders")
            .update({ status: "refunded" } as never)
            .eq("id", ex.order_id);
          sendRefundUpdate(ex.order_id, "completed", ex.amount, ex.currency).catch(() => undefined);
        }
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
