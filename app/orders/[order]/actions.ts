"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { sendRefundUpdate } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";

// Customer refund request from the order-confirmation URL. Guest checkout has
// no account, so access is via the order id (a v4 UUID). Hardening here:
//   - amount + currency are derived SERVER-SIDE from the order, never trusted
//     from the client (a client-supplied amount feeds the Stripe refund admins
//     later action — it must not be attacker-controllable).
//   - the requester must confirm the order email; it's verified against the row
//     (defence-in-depth + prevents accidental/automated requests).
//   - duplicate guard: one open/done refund per order.
// Full account-based scoping remains a larger separate effort.
export async function requestRefund(payload: { orderId: string; reason: string; email: string }) {
  const sb = createServiceClient();
  const { orderId, reason, email } = payload;

  const { data: orderData } = await sb
    .from("orders")
    .select("id, email, status, grand_total, currency")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as {
    id: string;
    email: string;
    status: string;
    grand_total: number;
    currency: string;
  } | null;
  if (!order || !["paid", "fulfilling", "shipped", "delivered"].includes(order.status)) {
    return { error: "Order not eligible for refund." };
  }

  // Verify the supplied email matches the order (case-insensitive).
  if ((email || "").trim().toLowerCase() !== order.email.toLowerCase()) {
    return { error: "That email doesn't match this order." };
  }

  // Duplicate guard — don't queue a second request if one is already in flight
  // or done.
  const { data: existing } = await sb
    .from("refunds")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["requested", "processing", "completed"])
    .maybeSingle();
  if (existing) return { error: "A refund is already in progress for this order." };

  // Amount + currency come from the order, NOT the client. Sanity-bound the
  // amount as defence-in-depth against a corrupted grand_total feeding the
  // later Stripe refund.
  const amount = order.grand_total;
  const currency = order.currency;
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 100000) {
    return { error: "This order can't be refunded automatically — please contact us." };
  }

  await sb.from("refunds").insert({
    order_id: orderId,
    amount,
    currency,
    reason: reason.slice(0, 500),
    status: "requested",
  } as never);

  const detail = `Order ${orderId} — ${amount} ${currency}: ${reason.slice(0, 200)}`;
  await sb.from("notifications").insert({
    type: "refund_requested",
    title: "Refund requested",
    body: detail,
    order_id: orderId,
  } as never);

  sendRefundUpdate(orderId, "requested", amount, currency).catch((e) =>
    console.error("refund request email:", e),
  );
  // Owner alert (gated by notification_prefs), separate from the customer email.
  notifyOwner("refund_requested", "Refund requested", detail).catch((e) =>
    console.error("refund owner alert:", e),
  );
  return { ok: true };
}
