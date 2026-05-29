import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";
import { formatPrice } from "@/lib/format";
import { RequestRefund } from "./RequestRefund";

type Address = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
};
type Tracking = { provider?: string; tracking_number?: string; tracking_url?: string };
type Item = {
  id: string;
  title: string;
  variant_title: string | null;
  quantity: number;
  unit_price: number;
  currency: string;
};
type Order = {
  id: string;
  order_number: string | null;
  status: string;
  currency: string;
  subtotal: number;
  shipping_total: number;
  grand_total: number;
  shipping_address: Address | null;
  tracking: Tracking[];
  placed_at: string | null;
  created_at: string;
};

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

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCustomer();
  if (!customer) redirect("/account/login");
  const { id } = await params;

  // RLS returns this only if it belongs to the signed-in customer.
  const sb = await createClient();
  const { data: orderData } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
  const order = orderData as unknown as Order | null;
  if (!order) notFound();

  const { data: itemsData } = await sb
    .from("order_items")
    .select("id, title, variant_title, quantity, unit_price, currency")
    .eq("order_id", id);
  const items = (itemsData as unknown as Item[]) ?? [];

  // Has the customer already got an open refund request?
  const { data: refundData } = await sb
    .from("refunds")
    .select("status, amount, currency")
    .eq("order_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const refund = refundData as unknown as {
    status: string;
    amount: number;
    currency: string;
  } | null;

  const addr = order.shipping_address;
  const tracking: Tracking[] = Array.isArray(order.tracking) ? order.tracking : [];
  const refundEligible = ["paid", "fulfilling", "shipped", "delivered"].includes(order.status);

  return (
    <div className="max-w-2xl">
      <Link
        href="/account"
        className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
      >
        ← All orders
      </Link>
      <div className="mt-2 flex items-baseline justify-between">
        <h2 className="font-display text-heading text-ink">
          {order.order_number ?? order.id.slice(0, 8)}
        </h2>
        <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
          {STATUS_LABEL[order.status] ?? order.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 font-mono text-caption text-ink/50">
        {new Date(order.placed_at ?? order.created_at).toLocaleString("en-GB")}
      </p>

      {/* Tracking */}
      {tracking.length > 0 && (
        <div className="mt-6 rounded-sm border border-accent-sea/30 bg-surface-2 px-4 py-3">
          <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">Tracking</p>
          {tracking.map((t, i) => (
            <p key={i} className="mt-1 font-body text-body text-ink">
              {t.provider ? `${t.provider}: ` : ""}
              {t.tracking_number ?? "—"}
              {t.tracking_url && (
                <>
                  {" "}
                  <a
                    href={t.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-sun"
                  >
                    Track →
                  </a>
                </>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Items */}
      <table className="mt-6 w-full text-left">
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-ink/10 font-body text-body text-ink">
              <td className="py-3">
                {i.title}
                {i.variant_title ? (
                  <span className="text-ink/50"> · {i.variant_title}</span>
                ) : null}{" "}
                × {i.quantity}
              </td>
              <td className="py-3 text-right font-mono">
                {formatPrice(i.unit_price * i.quantity, i.currency)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="font-mono text-caption">
          <tr>
            <td className="py-2 text-right text-ink/50">Subtotal</td>
            <td className="py-2 text-right">{formatPrice(order.subtotal, order.currency)}</td>
          </tr>
          <tr>
            <td className="py-2 text-right text-ink/50">Shipping</td>
            <td className="py-2 text-right">{formatPrice(order.shipping_total, order.currency)}</td>
          </tr>
          <tr>
            <td className="py-2 text-right font-bold">Total</td>
            <td className="py-2 text-right font-bold">
              {formatPrice(order.grand_total, order.currency)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Shipping address */}
      {addr && (
        <div className="mt-8">
          <p className="font-mono text-caption tracking-wide text-ink/50 uppercase">Shipping to</p>
          <address className="mt-1 not-italic font-body text-body text-ink/80 leading-relaxed">
            {addr.name && <div>{addr.name}</div>}
            {addr.line1 && <div>{addr.line1}</div>}
            {addr.line2 && <div>{addr.line2}</div>}
            {(addr.city || addr.postal_code) && (
              <div>{[addr.city, addr.postal_code].filter(Boolean).join(", ")}</div>
            )}
            {addr.country && <div>{addr.country}</div>}
          </address>
        </div>
      )}

      {/* Refund */}
      <div className="mt-10 border-t border-ink/10 pt-6">
        {refund && refund.status !== "rejected" ? (
          <p className="font-body text-caption text-ink/70">
            Refund {refund.status} — {formatPrice(refund.amount, refund.currency)}.
          </p>
        ) : refundEligible ? (
          <RequestRefund orderId={order.id} />
        ) : (
          <p className="font-body text-caption text-ink/50">
            This order isn&apos;t eligible for a refund.
          </p>
        )}
      </div>
    </div>
  );
}
