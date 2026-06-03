import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";
import { formatPrice } from "@/lib/format";
import { updateProfile } from "./actions";

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
