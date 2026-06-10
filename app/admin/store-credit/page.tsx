import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";
import { reasonLabel } from "@/lib/store-credit";
import { GrantForm } from "./GrantForm";

export default async function AdminStoreCreditPage() {
  await requireOps();
  const sb = createServiceClient();
  const { data } = await sb
    .from("store_credit_transactions")
    .select("id, amount, currency, reason, status, note, created_at, customers(email)")
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows =
    (data as unknown as Array<{
      id: string;
      amount: number;
      currency: string;
      reason: string;
      status: string;
      note: string | null;
      created_at: string;
      customers: { email: string } | null;
    }>) || [];

  // Outstanding liability = sum of all applied balances still owed to customers.
  const outstanding = rows
    .filter((r) => r.status === "applied")
    .reduce((s, r) => s + Number(r.amount), 0);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Store credit</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        Loyalty + referral credit ledger. Outstanding liability (unspent applied credit):{" "}
        <span className="font-mono text-ink">{formatPrice(Math.max(0, outstanding))}</span>.
      </p>

      <div className="mt-8 max-w-xl rounded-sm border border-ink/10 bg-surface-2 p-5">
        <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          Grant credit manually
        </h2>
        <GrantForm />
      </div>

      <div className="mt-8 overflow-x-auto rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2 font-mono text-caption tracking-wide text-ink/60 uppercase">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ink/10 font-body text-body text-ink">
                <td className="px-4 py-3 font-mono text-caption text-ink/60">
                  {fmtDate(r.created_at)}
                </td>
                <td className="px-4 py-3 text-ink/70">{r.customers?.email ?? "—"}</td>
                <td className="px-4 py-3">{r.note || reasonLabel(r.reason)}</td>
                <td className="px-4 py-3 font-mono text-caption uppercase">{r.status}</td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    Number(r.amount) >= 0 ? "text-accent-sea" : "text-ink/70"
                  }`}
                >
                  {Number(r.amount) >= 0 ? "+" : "−"}
                  {formatPrice(Math.abs(Number(r.amount)), r.currency)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-body text-ink/50">
                  No store-credit activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
