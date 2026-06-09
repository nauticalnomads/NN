"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { autoFulfilOrder } from "@/lib/fulfilment";
import { getStripe } from "@/lib/stripe";
import { sendShippingConfirmation, sendRefundUpdate } from "@/lib/email";

// Retry auto-fulfilment for an order. Clears SYNTHETIC prior attempts
// (dry-run / unmapped / failed / pending) so a live retry can actually place
// the order, while keeping real successful placements and manual fulfilments
// so we never duplicate a POD order. Guards: ops only, retryable state.
export async function retryFulfilment(formData: FormData): Promise<void> {
  await requireOps();
  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return;

  const sb = createServiceClient();
  const { data: orderData } = await sb
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as { status: string } | null;
  if (!order) return;

  const retryable = ["fulfilment_failed", "awaiting_fulfilment", "paid", "fulfilling"];
  if (!retryable.includes(order.status)) return;

  // Drop only synthetic/failed attempts. Keep real successes (numeric provider
  // ids) and manual fulfilments so a retry can't double-place a live order.
  const { data: attemptData } = await sb
    .from("fulfilment_attempts")
    .select("id, status, provider_order_id, idempotency_key")
    .eq("order_id", orderId);
  const attempts =
    (attemptData as unknown as Array<{
      id: string;
      status: string;
      provider_order_id: string | null;
      idempotency_key: string | null;
    }>) || [];
  const stale = attempts
    .filter((a) => {
      const pid = a.provider_order_id || "";
      if ((a.idempotency_key || "").endsWith("::manual")) return false; // keep manual
      if (a.status !== "success") return true; // failed/pending → clear
      return !pid || pid.startsWith("DRYRUN-") || pid.startsWith("UNMAPPED-"); // synthetic
    })
    .map((a) => a.id);
  if (stale.length) {
    await sb.from("fulfilment_attempts").delete().in("id", stale);
  }

  // Reset to `paid` so auto-fulfilment runs cleanly from the top.
  await sb
    .from("orders")
    .update({ status: "paid" } as never)
    .eq("id", orderId)
    .in("status", ["fulfilling", "fulfilment_failed", "awaiting_fulfilment"]);

  // autoFulfilOrder is idempotent on (order_id, provider) — safe to re-call.
  await autoFulfilOrder(orderId);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

// Paste a manual provider order reference + optional tracking number when the
// owner placed the POD order manually after auto-fulfilment failed.
export async function saveMannualFulfilment(formData: FormData): Promise<void> {
  await requireOps();
  const orderId = String(formData.get("order_id") || "");
  const provider = String(formData.get("provider") || "");
  const providerRef = String(formData.get("provider_ref") || "").trim();
  const tracking = String(formData.get("tracking") || "").trim();
  if (!orderId || !provider) return;

  const sb = createServiceClient();

  // Record as a manual fulfilment attempt.
  await sb.from("fulfilment_attempts").insert({
    order_id: orderId,
    provider,
    status: "success",
    idempotency_key: `${orderId}::${provider}::manual`,
    provider_order_id: providerRef || null,
    error_detail: null,
  } as never);

  // Update order status + tracking if provided.
  const updates: Record<string, unknown> = { status: "fulfilling" };
  if (tracking) {
    const { data: existing } = await sb
      .from("orders")
      .select("tracking")
      .eq("id", orderId)
      .maybeSingle();
    const existingTracking = (existing as unknown as { tracking: unknown } | null)?.tracking;
    const prev = Array.isArray(existingTracking) ? existingTracking : [];
    updates.tracking = [
      ...prev,
      { provider, tracking_number: tracking, source: "manual", added_at: new Date().toISOString() },
    ];
  }
  await sb
    .from("orders")
    .update(updates as never)
    .eq("id", orderId);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

// ── Manual status controls ───────────────────────────────────────────────────

const revalidate = (orderId: string) => {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
};

// Set an order status, guarded so we only advance from sensible states.
async function setOrderStatus(orderId: string, status: string, allowedFrom: string[]) {
  const sb = createServiceClient();
  await sb
    .from("orders")
    .update({ status } as never)
    .eq("id", orderId)
    .in("status", allowedFrom);
  revalidate(orderId);
}

// Mark an order fulfilled manually (no provider order id needed).
export async function markFulfilled(formData: FormData): Promise<void> {
  await requireOps();
  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return;
  await setOrderStatus(orderId, "fulfilling", [
    "paid",
    "awaiting_fulfilment",
    "fulfilment_failed",
    "fulfilling",
  ]);
}

// Mark an order shipped, optionally recording tracking + emailing the customer.
export async function markShipped(formData: FormData): Promise<void> {
  await requireOps();
  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return;
  const carrier = String(formData.get("carrier") || "").trim();
  const number = String(formData.get("tracking") || "").trim();
  const url = String(formData.get("tracking_url") || "").trim();

  const sb = createServiceClient();
  if (number || carrier || url) {
    const { data: existing } = await sb
      .from("orders")
      .select("tracking")
      .eq("id", orderId)
      .maybeSingle();
    const existingTracking = (existing as unknown as { tracking: unknown } | null)?.tracking;
    const prev = Array.isArray(existingTracking) ? existingTracking : [];
    await sb
      .from("orders")
      .update({
        status: "shipped",
        tracking: [
          ...prev,
          {
            carrier: carrier || null,
            tracking_number: number || null,
            url: url || null,
            source: "manual",
            added_at: new Date().toISOString(),
          },
        ],
      } as never)
      .eq("id", orderId)
      .in("status", ["paid", "awaiting_fulfilment", "fulfilling", "fulfilment_failed", "shipped"]);
  } else {
    await setOrderStatus(orderId, "shipped", [
      "paid",
      "awaiting_fulfilment",
      "fulfilling",
      "fulfilment_failed",
    ]);
  }
  // Let the customer know (best-effort — never blocks the status change).
  await sendShippingConfirmation(orderId, {
    carrier: carrier || undefined,
    number: number || undefined,
    url: url || undefined,
  }).catch((e) => console.error("manual shipping email:", e));
  revalidate(orderId);
}

// Mark an order delivered.
export async function markDelivered(formData: FormData): Promise<void> {
  await requireOps();
  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return;
  await setOrderStatus(orderId, "delivered", ["shipped", "fulfilling", "paid"]);
}

// Cancel an order (only before it has shipped). Does not auto-refund — issue a
// refund separately if payment was taken.
export async function cancelOrder(formData: FormData): Promise<void> {
  await requireOps();
  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return;
  await setOrderStatus(orderId, "cancelled", [
    "pending",
    "paid",
    "awaiting_fulfilment",
    "fulfilling",
    "fulfilment_failed",
  ]);
}

// Issue a FULL Stripe refund for the order's grand total, then mark it
// refunded. Records a `refunds` row (idempotent via the Stripe idempotency key
// so a double-click can't double-refund). Master + regular only.
export async function refundOrder(formData: FormData): Promise<void> {
  const admin = await requireOps();
  const orderId = String(formData.get("order_id") || "");
  if (!orderId) return;

  const sb = createServiceClient();
  const { data: orderData } = await sb
    .from("orders")
    .select("id, status, grand_total, currency, stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as {
    status: string;
    grand_total: number;
    currency: string;
    stripe_payment_intent_id: string | null;
  } | null;
  if (!order) return;
  if (["refunded", "cancelled"].includes(order.status)) return;

  const amount = Number(order.grand_total);

  // No Stripe charge (e.g. fully paid by gift card) — just mark refunded.
  if (!order.stripe_payment_intent_id || amount <= 0) {
    await sb.from("refunds").insert({
      order_id: orderId,
      amount,
      currency: order.currency,
      status: "completed",
      reason: "admin full refund (no Stripe charge)",
      requested_by: admin.id,
      actioned_by: admin.id,
    } as never);
    await setOrderStatus(orderId, "refunded", [order.status]);
    return;
  }

  // Record the refund row first (for audit + reconciliation by the webhook).
  const { data: refundRow } = await sb
    .from("refunds")
    .insert({
      order_id: orderId,
      amount,
      currency: order.currency,
      status: "processing",
      reason: "admin full refund",
      requested_by: admin.id,
      actioned_by: admin.id,
    } as never)
    .select("id")
    .single();
  const refundId = (refundRow as unknown as { id: string } | null)?.id ?? null;

  try {
    const stripe = getStripe();
    const r = await stripe.refunds.create(
      {
        payment_intent: order.stripe_payment_intent_id,
        amount: Math.round(amount * 100),
        metadata: { order_id: orderId, ...(refundId ? { refund_id: refundId } : {}) },
      },
      { idempotencyKey: `refund_order_${orderId}` },
    );
    if (refundId) {
      await sb
        .from("refunds")
        .update({ status: "completed", stripe_refund_id: r.id } as never)
        .eq("id", refundId);
    }
    await sb
      .from("orders")
      .update({ status: "refunded" } as never)
      .eq("id", orderId);
    await sendRefundUpdate(orderId, "completed", amount, order.currency).catch(() => undefined);
  } catch (err) {
    if (refundId) {
      await sb
        .from("refunds")
        .update({
          status: "failed",
          note: err instanceof Error ? err.message : "stripe error",
        } as never)
        .eq("id", refundId);
    }
  }
  revalidate(orderId);
}
