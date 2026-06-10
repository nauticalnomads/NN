import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";
import { formatPrice } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import {
  getAvailableCredit,
  getCreditLedger,
  ensureReferralCode,
  reasonLabel,
  LOYALTY_EARN_PERCENT,
  REFERRAL_REWARD,
} from "@/lib/store-credit";
import { updateProfile } from "./actions";
import { ReferralLink } from "./ReferralLink";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending payment",
  paid: "Paid",
  fulfilling: "Preparing",
  awaiting_fulfilment: "Preparing",
  fulfilment_failed: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function AccountPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/account/login?next=/account");

  // RLS scopes this to the customer's own orders.
  const sb = await createClient();
  const { data } = await sb
    .from("orders")
    .select("id, order_number, status, grand_total, currency, placed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const orders =
    (data as unknown as Array<{
      id: string;
      order_number: string | null;
      status: string;
      grand_total: number;
      currency: string;
      placed_at: string | null;
      created_at: string;
    }>) || [];

  // Loyalty: spendable balance, recent ledger, and the customer's referral link.
  const [creditBalance, ledger, referralCode] = await Promise.all([
    getAvailableCredit(customer.id, "GBP"),
    getCreditLedger(customer.id, 20),
    ensureReferralCode(customer),
  ]);
  const referralUrl = referralCode ? absoluteUrl(`/r/${referralCode}`) : null;
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-12">
      {/* Profile */}
      <section>
        <h2 className="font-mono text-caption tracking-wide text-ink/50 uppercase">Your details</h2>
        <form action={updateProfile} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Name</span>
            <input
              type="text"
              name="full_name"
              defaultValue={customer.full_name ?? ""}
              placeholder="Your name"
              className="mt-2 block w-64 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body text-ink"
            />
          </label>
          <div>
            <span className="block font-mono text-caption tracking-wide text-ink/60 uppercase">
              Email
            </span>
            <p className="mt-2 py-2 font-mono text-caption text-ink/60">{customer.email}</p>
          </div>
          <button className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase">
            Save
          </button>
        </form>
      </section>

      {/* Store credit */}
      <section>
        <h2 className="font-mono text-caption tracking-wide text-ink/50 uppercase">Store credit</h2>
        <div className="mt-4 rounded-sm border border-ink/10 bg-surface-2 p-5">
          <p className="font-display text-display-2 tracking-tight text-ink">
            {formatPrice(creditBalance, "GBP")}
          </p>
          <p className="mt-1 font-body text-body text-ink/60">
            Available to spend. Earn {LOYALTY_EARN_PERCENT}% back on every order — it&apos;s applied
            automatically at checkout.
          </p>
        </div>
        {ledger.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-sm border border-ink/10">
            <table className="w-full text-left">
              <thead className="bg-surface-2">
                <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((t) => (
                  <tr key={t.id} className="border-t border-ink/10 font-body text-body text-ink">
                    <td className="px-4 py-3 font-mono text-caption text-ink/60">
                      {fmtDate(t.created_at)}
                    </td>
                    <td className="px-4 py-3">{t.note || reasonLabel(t.reason)}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        t.amount >= 0 ? "text-accent-sea" : "text-ink/70"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : "−"}
                      {formatPrice(Math.abs(t.amount), t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Refer a friend */}
      {referralUrl && (
        <section>
          <h2 className="font-mono text-caption tracking-wide text-ink/50 uppercase">
            Refer a friend
          </h2>
          <p className="mt-4 font-body text-body text-ink/60">
            Share your link. When a friend signs up and places their first order, you both get{" "}
            <span className="text-ink">{formatPrice(REFERRAL_REWARD, "GBP")}</span> in store credit.
          </p>
          <ReferralLink url={referralUrl} />
        </section>
      )}

      {/* Order history */}
      <section>
        <h2 className="font-mono text-caption tracking-wide text-ink/50 uppercase">Your orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 font-body text-body text-ink/60">
            No orders yet.{" "}
            <Link href="/shop" className="text-accent-sun no-underline hover:underline">
              Browse the shop →
            </Link>
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-sm border border-ink/10">
            <table className="w-full text-left">
              <thead className="bg-surface-2">
                <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-ink/10 font-body text-body text-ink">
                    <td className="px-4 py-3 font-mono">
                      <Link
                        href={`/account/orders/${o.id}`}
                        className="text-ink no-underline hover:text-accent-sun"
                      >
                        {o.order_number ?? o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-caption text-ink/60">
                      {new Date(o.placed_at ?? o.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 font-mono text-caption uppercase">
                      {STATUS_LABEL[o.status] ?? o.status.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPrice(o.grand_total, o.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
