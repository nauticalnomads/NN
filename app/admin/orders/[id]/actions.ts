"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { autoFulfilOrder } from "@/lib/fulfilment";

// Retry auto-fulfilment for an order that previously failed or is awaiting.
// Guards: ops only, order must be in a retryable state.
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
