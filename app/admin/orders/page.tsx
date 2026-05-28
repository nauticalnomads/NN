import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";

const STATUS_CLASS: Record<string, string> = {
  paid: "text-accent-sea",
  fulfilment_failed: "text-accent-sun",
  shipped: "text-ink/70",
  delivered: "text-ink/50",
  cancelled: "text-ink/40",
  refunded: "text-ink/40",
};

export default async function AdminOrders() {
  await requireOps(); // master + regular only; content admin blocked
  const sb = await createClient();
  const { data } = await sb
    .from("orders")
    .select("id, order_number, email, status, grand_total, currency, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
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
      <h1 className="font-display text-display-2 tracking-tight text-ink">Orders</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        {rows.length} most recent. Failed/attention-needed pinned to the top.
      </p>
      <div className="mt-8 overflow-hidden rounded-sm border border-ink/10">
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
              <tr key={o.id} className="border-t border-ink/10 font-body text-body text-ink">
                <td className="px-4 py-3 font-mono">{o.order_number ?? o.id.slice(0, 8)}</td>
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
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
