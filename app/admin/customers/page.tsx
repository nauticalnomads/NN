import Link from "next/link";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Customers", robots: { index: false, follow: false } };

// Statuses that count toward lifetime value (mirrors the dashboard KPIs).
const PAID_STATUSES = ["paid", "awaiting_fulfilment", "fulfilling", "shipped", "delivered"];

type Customer = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireOps(); // customer PII + spend — ops only
  const { q = "" } = await searchParams;
  const sb = createServiceClient();

  let query = sb
    .from("customers")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q.trim()) query = query.ilike("email", `%${q.trim()}%`);
  const { data } = await query;
  const customers = (data as unknown as Customer[]) ?? [];

  // Order counts + lifetime value for the listed customers, aggregated in one
  // query (50 ids max) rather than per-row lookups.
  const totals = new Map<string, { orders: number; ltv: number }>();
  if (customers.length) {
    const { data: orderRows } = await sb
      .from("orders")
      .select("customer_id, grand_total, status")
      .in(
        "customer_id",
        customers.map((c) => c.id),
      )
      .in("status", PAID_STATUSES);
    for (const o of (orderRows as unknown as {
      customer_id: string;
      grand_total: number;
    }[]) ?? []) {
      const t = totals.get(o.customer_id) ?? { orders: 0, ltv: 0 };
      t.orders += 1;
      t.ltv += Number(o.grand_total || 0);
      totals.set(o.customer_id, t);
    }
  }

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Customers</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        {q ? `Matches for “${q}”` : "Most recent sign-ups"} — orders and lifetime value count paid
        orders only.
      </p>

      <form className="mt-6 flex gap-3" action="/admin/customers" method="get">
        <input
          name="q"
          defaultValue={q}
          type="search"
          placeholder="Search by email…"
          className="w-full max-w-sm rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
        />
        <button className="rounded-sm border border-ink/20 px-4 py-2 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-ink/50">
          Search
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2">
            <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Lifetime value</th>
              <th className="px-4 py-3 text-right">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const t = totals.get(c.id) ?? { orders: 0, ltv: 0 };
              return (
                <tr
                  key={c.id}
                  className="border-t border-ink/10 font-body text-body text-ink hover:bg-surface-2"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="text-ink no-underline hover:text-accent-sun"
                    >
                      {c.email}
                    </Link>
                    {c.full_name && (
                      <p className="font-mono text-caption text-ink/45">{c.full_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{t.orders}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPrice(t.ltv, "GBP")}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink/60">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-body text-ink/50">
                  {q ? "No customers match that email." : "No customers yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
