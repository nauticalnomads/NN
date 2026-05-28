import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";
import { formatPrice } from "@/lib/format";

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireOps();
  const sp = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = sp.from ? new Date(sp.from) : monthStart;
  const to = sp.to ? new Date(sp.to) : now;

  let revenue = 0,
    fees = 0,
    refunds = 0,
    cogs = 0;
  let stripeUnreachable = false;

  // Pull Stripe data for the period.
  try {
    const stripe = getStripe();
    const balance = await stripe.balanceTransactions.list({
      created: { gte: Math.floor(from.getTime() / 1000), lte: Math.floor(to.getTime() / 1000) },
      limit: 100,
    });
    for (const t of balance.data) {
      if (t.type === "charge") {
        revenue += t.amount / 100;
        fees += (t.fee ?? 0) / 100;
      }
      if (t.type === "refund") refunds += Math.abs(t.amount) / 100;
    }
  } catch {
    stripeUnreachable = true;
  }

  // Pull COGS from local order_items in the period.
  const sb = createServiceClient();
  const { data } = await sb
    .from("order_items")
    .select("base_cost, quantity, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());
  const items = (data as unknown as Array<{ base_cost: number | null; quantity: number }>) || [];
  for (const i of items) if (i.base_cost) cogs += i.base_cost * i.quantity;

  const profit = revenue - cogs - fees - refunds;
  const fmt = (n: number) => formatPrice(n, "GBP");
  const csvHref = `/api/admin/financial.csv?from=${from.toISOString()}&to=${to.toISOString()}`;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Financial</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        Estimates to assist filing — not a substitute for professional accounting.
      </p>
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">From</span>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="mt-2 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption"
          />
        </label>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">To</span>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="mt-2 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption"
          />
        </label>
        <button className="rounded-sm bg-ink px-4 py-2 font-mono text-caption tracking-widest text-surface uppercase">
          Update
        </button>
        <a
          href={csvHref}
          className="font-mono text-caption tracking-widest text-ink uppercase underline-offset-4 hover:underline"
        >
          Export CSV
        </a>
      </form>

      {stripeUnreachable && (
        <p className="mt-6 rounded-sm border border-accent-sun/40 bg-surface-2 px-4 py-3 font-mono text-caption text-accent-sun">
          Stripe unreachable — revenue/fees show £0. Check STRIPE_SECRET_KEY.
        </p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Stat label="Revenue" value={fmt(revenue)} />
        <Stat label="Stripe fees" value={fmt(fees)} dim />
        <Stat label="Refunds" value={fmt(refunds)} dim />
        <Stat label="Cost of goods (est)" value={fmt(cogs)} dim />
      </div>
      <div className="mt-6 rounded-sm border border-ink/10 bg-surface-2 p-5">
        <p className="font-mono text-caption tracking-wide text-ink/50 uppercase">
          Estimated profit
        </p>
        <p
          className={`mt-2 font-display text-display-2 ${profit >= 0 ? "text-ink" : "text-accent-sun"}`}
        >
          {fmt(profit)}
        </p>
        <p className="mt-2 font-mono text-caption text-ink/50">
          Revenue − COGS − Stripe fees − refunds. Excludes any shipping you pay and FX.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="rounded-sm border border-ink/10 p-5">
      <p className="font-mono text-caption tracking-wide text-ink/50 uppercase">{label}</p>
      <p className={`mt-2 font-display text-heading ${dim ? "text-ink/70" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
