import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";
import { issueRefund } from "./actions";

export default async function RefundsPage() {
  await requireOps();
  const sb = createServiceClient();
  const { data } = await sb
    .from("refunds")
    .select("id, order_id, amount, currency, reason, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows =
    (data as unknown as Array<{
      id: string;
      order_id: string;
      amount: number;
      currency: string;
      reason: string | null;
      status: string;
      created_at: string;
    }>) || [];

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Refunds</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        Customer requests + admin-issued refunds. Action via Stripe directly from here.
      </p>
      <div className="mt-8 overflow-hidden rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2 font-mono text-caption tracking-wide text-ink/60 uppercase">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ink/10 font-body text-body text-ink">
                <td className="px-4 py-3 font-mono">{r.order_id.slice(0, 8)}</td>
                <td className="px-4 py-3 font-mono">{formatPrice(r.amount, r.currency)}</td>
                <td className="px-4 py-3 text-ink/70">{r.reason ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-caption uppercase">{r.status}</td>
                <td className="px-4 py-3">
                  {r.status === "requested" && (
                    <form action={issueRefund}>
                      <input type="hidden" name="refund_id" value={r.id} />
                      <button className="rounded-sm bg-accent-sun px-3 py-1 font-mono text-xs tracking-widest text-surface uppercase">
                        Issue refund
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-body text-ink/50">
                  No refund activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
