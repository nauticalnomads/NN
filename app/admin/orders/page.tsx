import Link from "next/link";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { FILTERS } from "./filters";

const STATUS_CLASS: Record<string, string> = {
  paid: "text-accent-sea",
  fulfilment_failed: "text-accent-sun",
  shipped: "text-ink/70",
  delivered: "text-ink/50",
  cancelled: "text-ink/40",
  refunded: "text-ink/40",
};

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireOps(); // master + regular only; content admin blocked
  const { status = "" } = await searchParams;
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0];

  const sb = await createClient();
  let query = sb
    .from("orders")
    .select("id, order_number, email, status, grand_total, currency, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter.statuses) query = query.in("status", filter.statuses);
  const { data } = await query;
  const rows =
    (data as unknown as Array<{
      id: string;
      order_number: string | null;
      email: string;
      status: string;
      grand_total: number;
      currency: string;
      created_at: string;
    }>) || [];
  // Pin attention-needed orders to the top per §B-07.
  rows.sort(
    (a, b) => Number(b.status === "fulfilment_failed") - Number(a.status === "fulfilment_failed"),
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-display-2 tracking-tight text-ink">Orders</h1>
        <a
          href={`/admin/orders/export${filter.key ? `?status=${filter.key}` : ""}`}
          className="rounded-sm border border-ink/20 px-4 py-2 font-mono text-xs tracking-widest text-ink/70 uppercase no-underline hover:border-ink/50"
        >
          Export CSV
        </a>
      </div>
      <p className="mt-3 font-body text-body text-ink/60">
        {rows.length} most recent{filter.key ? ` (${filter.label.toLowerCase()})` : ""}.
        Failed/attention-needed pinned to the top.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/admin/orders?status=${f.key}` : "/admin/orders"}
            className={`rounded-sm border px-3 py-1.5 font-mono text-caption no-underline transition-colors ${
              f.key === filter.key
                ? "border-ink bg-ink text-surface"
                : "border-ink/20 text-ink/70 hover:border-ink/50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2">
            <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Placed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                className="border-t border-ink/10 font-body text-body text-ink hover:bg-surface-2"
              >
                <td className="px-4 py-3 font-mono">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-ink no-underline hover:text-accent-sun"
                  >
                    {o.order_number ?? o.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.email}</td>
                <td
                  className={`px-4 py-3 font-mono text-caption uppercase ${STATUS_CLASS[o.status] || ""}`}
                >
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-body text-ink/50">
                  {filter.key ? `No ${filter.label.toLowerCase()} orders.` : "No orders yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
