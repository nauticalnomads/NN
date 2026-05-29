// Shared financial summary used by both the dashboard page and the exports.
// Estimates only (master architecture §7) — COGS excludes shipping you pay + FX.
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";

export type FinancialSummary = {
  from: Date;
  to: Date;
  revenue: number;
  fees: number;
  refunds: number;
  cogs: number;
  profit: number;
  stripeUnreachable: boolean;
};

export async function getFinancialSummary(from: Date, to: Date): Promise<FinancialSummary> {
  let revenue = 0;
  let fees = 0;
  let refunds = 0;
  let cogs = 0;
  let stripeUnreachable = false;

  try {
    const stripe = getStripe();
    // Auto-paginate so date ranges with > 100 transactions aren't undercounted.
    // Capped at 5000 txns to stay well inside the Workers time limit.
    const txns = await stripe.balanceTransactions
      .list({
        created: { gte: Math.floor(from.getTime() / 1000), lte: Math.floor(to.getTime() / 1000) },
        limit: 100,
      })
      .autoPagingToArray({ limit: 5000 });
    for (const t of txns) {
      if (t.type === "charge") {
        revenue += t.amount / 100;
        fees += (t.fee ?? 0) / 100;
      }
      if (t.type === "refund") refunds += Math.abs(t.amount) / 100;
    }
  } catch {
    stripeUnreachable = true;
  }

  const sb = createServiceClient();
  const { data } = await sb
    .from("order_items")
    .select("base_cost, quantity, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());
  const items = (data as unknown as Array<{ base_cost: number | null; quantity: number }>) || [];
  for (const i of items) if (i.base_cost) cogs += i.base_cost * i.quantity;

  return {
    from,
    to,
    revenue,
    fees,
    refunds,
    cogs,
    profit: revenue - cogs - fees - refunds,
    stripeUnreachable,
  };
}
