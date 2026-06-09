"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { autoFulfilOrder } from "@/lib/fulfilment";

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
