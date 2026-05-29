"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { sendRefundUpdate } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";

// Customer refund request — service client (no auth required by design for the
// order-confirmation URL; the order id is a UUID and acts as the bearer).
// Inserts a `refunds` row in `requested` state. Admins action via /admin/orders.
export async function requestRefund(payload: {
  orderId: string;
  reason: string;
  amount: number;
  currency: string;
}) {
  const sb = createServiceClient();
  const { orderId, reason, amount, currency } = payload;

  // Verify the order exists and is paid (avoids spurious requests).
  const { data: orderData } = await sb
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as { status: string } | null;
  if (!order || !["paid", "fulfilling", "shipped", "delivered"].includes(order.status)) {
    return { error: "Order not eligible for refund." };
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

  sendRefundUpdate(orderId, "requested", amount, currency).catch(() => undefined);
  // Owner alert (gated by notification_prefs), separate from the customer email.
  notifyOwner("refund_requested", "Refund requested", detail).catch(() => undefined);
  return { ok: true };
}
