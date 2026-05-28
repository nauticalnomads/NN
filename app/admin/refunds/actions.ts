"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { sendRefundUpdate } from "@/lib/email";

// Issue the actual Stripe refund for a `refunds` row in 'requested' state.
// Master + regular only — content admin is blocked by requireOps.
export async function issueRefund(formData: FormData) {
  const admin = await requireOps();
  const refundId = String(formData.get("refund_id") || "");
  if (!refundId) return;

  const sb = createServiceClient();
  const { data: refundData } = await sb
    .from("refunds")
    .select("id, order_id, amount, currency, status")
    .eq("id", refundId)
    .maybeSingle();
  const refund = refundData as unknown as {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  } | null;
  if (!refund || refund.status !== "requested") return;

  const { data: orderData } = await sb
    .from("orders")
    .select("stripe_payment_intent_id")
    .eq("id", refund.order_id)
    .maybeSingle();
  const order = orderData as unknown as { stripe_payment_intent_id: string | null } | null;
  if (!order?.stripe_payment_intent_id) {
    await sb
      .from("refunds")
      .update({ status: "failed", note: "no payment_intent on order" } as never)
      .eq("id", refundId);
    return;
  }

  try {
    const stripe = getStripe();
    const r = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: Math.round(refund.amount * 100),
      metadata: { order_id: refund.order_id, refund_id: refund.id },
    });
    await sb
      .from("refunds")
      .update({
        status: "completed",
        stripe_refund_id: r.id,
        actioned_by: admin.id,
      } as never)
      .eq("id", refundId);
    await sb
      .from("orders")
      .update({ status: "refunded" } as never)
      .eq("id", refund.order_id);
    await sendRefundUpdate(refund.order_id, "completed", refund.amount, refund.currency).catch(
      () => undefined,
    );
  } catch (err) {
    await sb
      .from("refunds")
      .update({
        status: "failed",
        note: err instanceof Error ? err.message : "stripe error",
      } as never)
      .eq("id", refundId);
  }
  revalidatePath("/admin/refunds");
}
