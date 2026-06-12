import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getAvailableCredit } from "@/lib/store-credit";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Customer", robots: { index: false, follow: false } };

const PAID_STATUSES = ["paid", "awaiting_fulfilment", "fulfilling", "shipped", "delivered"];

type Customer = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  referral_code: string | null;
  referred_by: string | null;
};
type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  grand_total: number;
  currency: string;
  created_at: string;
};
type CreditTx = {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  note: string | null;
  created_at: string;
};

// Consolidated per-customer view: profile, lifetime value, full order history,
// store-credit balance + ledger, and referrals. All reads are service-role
// (page is ops-gated) and best-effort.
export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireOps();
  const { id } = await params;
  const sb = createServiceClient();

  const { data: custData } = await sb
    .from("customers")
    .select("id, email, full_name, created_at, referral_code, referred_by")
    .eq("id", id)
    .maybeSingle();
  const customer = custData as unknown as Customer | null;
  if (!customer) notFound();

  const [ordersRes, creditRes, referredRes, balance] = await Promise.all([
    sb
      .from("orders")
      .select("id, order_number, status, grand_total, currency, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("store_credit_transactions")
      .select("id, amount, currency, reason, status, note, created_at")
      .eq("customer_id", id)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(50),
    sb.from("customers").select("id, email, created_at").eq("referred_by", id),
    getAvailableCredit(id, "GBP").catch(() => 0),
  ]);

  const orders = (ordersRes.data as unknown as OrderRow[]) ?? [];
  const ledger = (creditRes.data as unknown as CreditTx[]) ?? [];
  const referred =
    (referredRes.data as unknown as { id: string; email: string; created_at: string }[]) ?? [];
  const paid = orders.filter((o) => PAID_STATUSES.includes(o.status));
  const ltv = paid.reduce((s, o) => s + Number(o.grand_total || 0), 0);

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/customers"
        className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
      >
        ← Customers
      </Link>
      <h1 className="mt-2 font-display text-display-2 tracking-tight text-ink">
        {customer.full_name || customer.email}
      </h1>
      <p className="mt-1 font-mono text-caption text-ink/50">
        {customer.email} · joined {new Date(customer.created_at).toLocaleDateString("en-GB")}
        {customer.referral_code && <> · referral code {customer.referral_code}</>}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Lifetime value" value={formatPrice(ltv, "GBP")} />
        <Stat label="Paid orders" value={paid.length} />
        <Stat label="Store credit" value={formatPrice(balance, "GBP")} />
        <Stat label="Referred" value={referred.length} />
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Orders ({orders.length})
        </h2>
        <div className="mt-3 overflow-hidden rounded-sm border border-ink/10">
          <table className="w-full text-left">
            <thead className="bg-surface-2">
              <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-ink/10 font-body text-body text-ink">
                  <td className="px-4 py-3 font-mono">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-ink no-underline hover:text-accent-sun"
                    >
                      {o.order_number ?? o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-caption uppercase">
                    {o.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatPrice(o.grand_total, o.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink/60">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center font-body text-ink/50">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {ledger.length > 0 && (
        <section className="mt-10">
          <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Store credit ledger
          </h2>
          <ul className="mt-3 space-y-2">
            {ledger.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-sm border border-ink/10 px-4 py-3"
              >
                <div>
                  <p className="font-body text-body text-ink">
                    {t.reason.replace(/_/g, " ")}
                    {t.note && <span className="text-ink/50"> — {t.note}</span>}
                  </p>
                  <p className="font-mono text-caption text-ink/45">
                    {new Date(t.created_at).toLocaleString("en-GB")} · {t.status}
                  </p>
                </div>
                <p
                  className={`font-mono text-body ${t.amount >= 0 ? "text-accent-sea" : "text-ink/70"}`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {formatPrice(t.amount, t.currency)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {referred.length > 0 && (
        <section className="mt-10">
          <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Referred customers
          </h2>
          <ul className="mt-3 space-y-1">
            {referred.map((r) => (
              <li key={r.id} className="font-body text-body">
                <Link
                  href={`/admin/customers/${r.id}`}
                  className="text-ink no-underline hover:text-accent-sun"
                >
                  {r.email}
                </Link>{" "}
                <span className="font-mono text-caption text-ink/45">
                  joined {new Date(r.created_at).toLocaleDateString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-sm border border-ink/10 bg-surface-2 p-5">
      <p className="font-mono text-caption tracking-wide text-ink/50 uppercase">{label}</p>
      <p className="mt-2 font-display text-heading text-ink">{value}</p>
    </div>
  );
}
