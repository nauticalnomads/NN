"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCustomer } from "@/lib/customer";
import { sendRefundUpdate } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";

// Update the signed-in customer's profile (name only for now).
export async function updateProfile(formData: FormData): Promise<void> {
  const customer = await getCustomer();
  if (!customer) return;
  const full_name = String(formData.get("full_name") || "").trim() || null;
  const svc = createServiceClient();
  await svc
    .from("customers")
    .update({ full_name } as never)
    .eq("id", customer.id);
  revalidatePath("/account");
}

// Authenticated refund request — replaces the UUID-as-bearer guest flow with
// proper ownership: the order is read through the cookie-bound client so RLS
// only returns it if it belongs to the signed-in customer. No order_id from the
// client is trusted beyond that scoped lookup.
export async function requestRefundAuthed(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const customer = await getCustomer();
  if (!customer) return { error: "Please sign in." };

  const orderId = String(formData.get("order_id") || "");
  const reason = String(formData.get("reason") || "").slice(0, 500);
  if (!orderId) return { error: "Missing order." };

  // Scoped read: RLS returns this row only if the customer owns it.
  const rls = await createClient();
  const { data: orderData } = await rls
    .from("orders")
    .select("id, status, grand_total, currency")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as {
    id: string;
    status: string;
    grand_total: number;
    currency: string;
  } | null;
  if (!order) return { error: "Order not found." };
  if (!["paid", "fulfilling", "shipped", "delivered"].includes(order.status)) {
    return { error: "This order isn't eligible for a refund." };
  }

  const svc = createServiceClient();
  // Don't allow duplicate open requests.
  const { data: existing } = await svc
    .from("refunds")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["requested", "processing"])
    .maybeSingle();
  if (existing) return { error: "A refund request is already in progress for this order." };

  await svc.from("refunds").insert({
    order_id: orderId,
    amount: order.grand_total,
    currency: order.currency,
    reason,
    status: "requested",
    requested_by: customer.id,
  } as never);

  const detail = `Order ${orderId} — ${order.grand_total} ${order.currency}: ${reason.slice(0, 200)}`;
  await svc.from("notifications").insert({
    type: "refund_requested",
    title: "Refund requested",
    body: detail,
    order_id: orderId,
  } as never);

  sendRefundUpdate(orderId, "requested", order.grand_total, order.currency).catch(() => undefined);
  notifyOwner("refund_requested", "Refund requested", detail).catch(() => undefined);

  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account");
  return { ok: true };
}
