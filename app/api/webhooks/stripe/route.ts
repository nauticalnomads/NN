import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { markOrderPaid } from "@/lib/orders";
import { sendRefundUpdate } from "@/lib/email";
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
    // On Workers, signature verification must use the async SubtleCrypto path —
    // the synchronous constructEvent relies on Node's crypto and throws here.
    event = await stripe.webhooks.constructEventAsync(
      raw,
      sig,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
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
        // Only finalize genuinely-paid sessions. A session can complete `unpaid`
        // (async payment methods, or a voided/expired flow), and we must never
        // mark such an order paid.
        if (s.payment_status && s.payment_status !== "paid") break;
        const pi = typeof s.payment_intent === "string" ? s.payment_intent : null;
        // Shared with the order-page fallback; idempotent + fires side effects.
        await markOrderPaid(orderId, pi);
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

        // The `charge.refunds` sublist is NOT reliably expanded on the webhook
        // payload, so fetch the refunds explicitly rather than trusting inline data.
        const refundList = await stripe.refunds.list({ charge: charge.id, limit: 100 });
        for (const sr of refundList.data) {
          if (sr.status !== "succeeded") continue;
          const amount = sr.amount / 100;

          // 1) Already reconciled this exact Stripe refund? Idempotent no-op.
          const { data: byStripeId } = await sb
            .from("refunds")
            .select("id, status")
            .eq("stripe_refund_id", sr.id)
            .maybeSingle();
          const existing = byStripeId as unknown as { id: string; status: string } | null;
          if (existing) {
            if (existing.status !== "completed") {
              await sb
                .from("refunds")
                .update({ status: "completed" } as never)
                .eq("id", existing.id);
              await sb
                .from("orders")
                .update({ status: "refunded" } as never)
                .eq("id", ord.id);
              sendRefundUpdate(ord.id, "completed", amount, sr.currency).catch((e) =>
                console.error("refund email:", e),
              );
            }
            continue;
          }

          // 2) Match an open local refund for this order BY AMOUNT (minor units),
          // so a £10 Stripe refund can't complete a £50 request.
          const { data: open } = await sb
            .from("refunds")
            .select("id, amount")
            .eq("order_id", ord.id)
            .is("stripe_refund_id", null)
            .not("status", "in", '("completed","rejected")')
            .order("created_at");
          const match = ((open as unknown as { id: string; amount: number }[]) ?? []).find(
            (r) => Math.round(r.amount * 100) === sr.amount,
          );
          if (match) {
            await sb
              .from("refunds")
              .update({ status: "completed", stripe_refund_id: sr.id } as never)
              .eq("id", match.id);
          } else {
            // 3) No matching request — refund was issued in the Stripe dashboard.
            // Insert a reconciliation row so it's visible in admin.
            await sb.from("refunds").insert({
              order_id: ord.id,
              amount,
              currency: sr.currency,
              status: "completed",
              stripe_refund_id: sr.id,
              reason: "refund via stripe dashboard",
            } as never);
          }
          await sb
            .from("orders")
            .update({ status: "refunded" } as never)
            .eq("id", ord.id);
          sendRefundUpdate(ord.id, "completed", amount, sr.currency).catch((e) =>
            console.error("refund email:", e),
          );
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
          sendRefundUpdate(ex.order_id, "completed", ex.amount, ex.currency).catch((e) =>
            console.error("refund email:", e),
          );
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
