import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";

export default async function AdminGiftCardsPage() {
  await requireOps();
  const sb = createServiceClient();
  const { data } = await sb
    .from("gift_cards")
    .select(
      "id, code, initial_amount, balance, currency, status, purchaser_email, expires_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const rows =
    (data as unknown as Array<{
      id: string;
      code: string;
      initial_amount: number;
      balance: number;
      currency: string;
      status: string;
      purchaser_email: string | null;
      expires_at: string | null;
      created_at: string;
    }>) || [];

  const fmtDate = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "—";

  const outstanding = rows
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Gift cards</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        Issued cards and remaining balances. Outstanding liability (active balances):{" "}
        <span className="font-mono text-ink">{formatPrice(outstanding)}</span>.
      </p>
      <div className="mt-8 overflow-x-auto rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2 font-mono text-caption tracking-wide text-ink/60 uppercase">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Purchaser</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ink/10 font-body text-body text-ink">
                <td className="px-4 py-3 font-mono text-caption">{r.code}</td>
                <td className="px-4 py-3 font-mono">{formatPrice(r.initial_amount, r.currency)}</td>
                <td className="px-4 py-3 font-mono">{formatPrice(r.balance, r.currency)}</td>
                <td className="px-4 py-3 font-mono text-caption uppercase">{r.status}</td>
                <td className="px-4 py-3 text-ink/70">{r.purchaser_email ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-caption">{fmtDate(r.expires_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-body text-ink/50">
                  No gift cards issued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
