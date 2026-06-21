import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { tokenAuthorized } from "@/lib/webhook-auth";

// Housekeeping for abandoned checkouts. A Stripe Checkout session expires after
// ~24h, so an order still `pending` well past that can never be paid. This:
//   1. releases any store-credit / gift-card reservations held against those
//      orders (so an abandoned checkout never strands a customer's balance —
//      important now that reservations are netted from available credit), then
//   2. cancels the dead pending orders.
// Driven by the same hourly cron fan-out (worker.js). Bounded + idempotent.
const CUTOFF_HOURS = 72;

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!tokenAuthorized(expected, request.headers.get("x-nn-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - CUTOFF_HOURS * 3_600_000).toISOString();

  const { data } = await sb
    .from("orders")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .limit(200);
  const ids = ((data as unknown as Array<{ id: string }>) ?? []).map((o) => o.id);
  if (ids.length === 0) return NextResponse.json({ cancelled: 0 });

  // Release reservations first (pending-only → idempotent), so the credit frees
  // up even if the status update is retried on the next tick.
  await sb
    .from("store_credit_transactions")
    .update({ status: "void" } as never)
    .in("order_id", ids)
    .eq("status", "pending");
  await sb
    .from("gift_card_redemptions")
    .update({ status: "void" } as never)
    .in("order_id", ids)
    .eq("status", "pending");

  const { data: upd } = await sb
    .from("orders")
    .update({ status: "cancelled" } as never)
    .in("id", ids)
    .eq("status", "pending")
    .select("id");
  const cancelled = Array.isArray(upd) ? upd.length : 0;

  return NextResponse.json({ cancelled });
}
