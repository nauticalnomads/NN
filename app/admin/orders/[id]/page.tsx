import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";
import { retryFulfilment, saveMannualFulfilment } from "./actions";

type ShippingAddress = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
};
type TrackingEntry = {
  provider?: string;
  tracking_number?: string;
  tracking_url?: string;
  source?: string;
  added_at?: string;
};
type ProviderOrder = { provider: string; provider_order_id?: string; status?: string };
type OrderItem = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string;
  provider: string | null;
  provider_product_id: string | null;
  provider_variant_id: string | null;
  quantity: number;
  unit_price: number;
  base_cost: number | null;
  currency: string;
};
type Attempt = {
  id: string;
  provider: string | null;
  status: string;
  provider_order_id: string | null;
  error_detail: string | null;
  retry_count: number;
  attempted_at: string;
};
type Order = {
  id: string;
  order_number: string | null;
  email: string;
  status: string;
  currency: string;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  grand_total: number;
  shipping_address: ShippingAddress | null;
  stripe_payment_intent_id: string | null;
  provider_orders: ProviderOrder[];
  tracking: TrackingEntry[];
  placed_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  fulfilling: "Fulfilling",
  awaiting_fulfilment: "Awaiting fulfilment",
  fulfilment_failed: "Fulfilment failed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const NEEDS_ATTENTION = ["fulfilment_failed", "awaiting_fulfilment"];

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOps();
  const { id } = await params;
  const sb = createServiceClient();

  const [orderRes, itemsRes, attemptsRes] = await Promise.all([
    sb.from("orders").select("*").eq("id", id).maybeSingle(),
    sb.from("order_items").select("*").eq("order_id", id).order("created_at"),
    sb
      .from("fulfilment_attempts")
      .select("*")
      .eq("order_id", id)
      .order("attempted_at", { ascending: false }),
  ]);

  const order = orderRes.data as unknown as Order | null;
  if (!order) notFound();

  const items = (itemsRes.data as unknown as OrderItem[]) ?? [];
  const attempts = (attemptsRes.data as unknown as Attempt[]) ?? [];
  const addr = order.shipping_address;
  const tracking: TrackingEntry[] = Array.isArray(order.tracking) ? order.tracking : [];
  const providerOrders: ProviderOrder[] = Array.isArray(order.provider_orders)
    ? order.provider_orders
    : [];

  const needsAttention = NEEDS_ATTENTION.includes(order.status);
  // Orders fulfilled in dry-run mode were never sent to the provider; offer a
  // retry so they can be placed for real once live (the retry clears the
  // synthetic DRYRUN attempt first).
  const hasDryRun = attempts.some((a) => (a.provider_order_id ?? "").startsWith("DRYRUN-"));
  const showFulfilmentTools = needsAttention || hasDryRun;
  // Providers involved in this order (for the manual-fallback form).
  const providers = [...new Set(items.map((i) => i.provider).filter(Boolean))] as string[];

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/orders"
            className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
          >
            ← Orders
          </Link>
          <h1 className="mt-2 font-display text-display-2 tracking-tight text-ink">
            {order.order_number ?? order.id.slice(0, 8)}
          </h1>
          <p className="mt-1 font-mono text-caption text-ink/50">
            {order.placed_at
              ? new Date(order.placed_at).toLocaleString("en-GB")
              : new Date(order.created_at).toLocaleString("en-GB")}
          </p>
        </div>
        <span
          className={`mt-6 rounded-sm border px-3 py-1 font-mono text-xs tracking-widest uppercase ${
            order.status === "fulfilment_failed"
              ? "border-accent-sun/60 text-accent-sun"
              : order.status === "awaiting_fulfilment"
                ? "border-accent-sun/40 text-accent-sun/80"
                : order.status === "shipped" || order.status === "delivered"
                  ? "border-ink/20 text-ink/50"
                  : "border-ink/20 text-ink/70"
          }`}
        >
          {STATUS_LABEL[order.status] ?? order.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Attention banner */}
      {needsAttention && (
        <div className="mt-6 rounded-sm border border-accent-sun/40 bg-surface-2 px-4 py-3 font-mono text-caption text-accent-sun">
          This order needs attention. Auto-fulfilment{" "}
          {order.status === "awaiting_fulfilment" ? "is paused (kill-switch)" : "failed"} — use the
          manual fallback or retry below.
        </div>
      )}

      <div className="mt-8 space-y-8">
        {/* Customer + shipping */}
        <Section title="Customer">
          <Field label="Email" value={order.email} mono />
          {order.stripe_payment_intent_id && (
            <Field label="Stripe PI" value={order.stripe_payment_intent_id} mono />
          )}
          {addr && (
            <div>
              <Label>Shipping address</Label>
              <address className="mt-1 not-italic font-body text-body text-ink leading-relaxed">
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
        </Section>

        {/* Line items */}
        <Section title="Items">
          <div className="overflow-hidden rounded-sm border border-ink/10">
            <table className="w-full text-left">
              <thead className="bg-surface-2">
                <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-ink/10 font-body text-body text-ink">
                    <td className="px-4 py-3">
                      <div>{item.title}</div>
                      {item.variant_title && (
                        <div className="font-body text-caption text-ink/50">
                          {item.variant_title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-caption">{item.sku}</td>
                    <td className="px-4 py-3">
                      {item.provider ? (
                        <div>
                          <div className="font-mono text-caption uppercase">{item.provider}</div>
                          {item.provider_product_id && (
                            <div className="font-mono text-[10px] text-ink/40">
                              prod: {item.provider_product_id}
                            </div>
                          )}
                          {item.provider_variant_id && (
                            <div className="font-mono text-[10px] text-ink/40">
                              var: {item.provider_variant_id}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-caption text-accent-sun">unmapped</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPrice(item.unit_price * item.quantity, item.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-ink/10 bg-surface-2">
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-2 font-mono text-caption text-ink/50 text-right"
                  >
                    Subtotal
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-caption">
                    {formatPrice(order.subtotal, order.currency)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-2 font-mono text-caption text-ink/50 text-right"
                  >
                    Shipping
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-caption">
                    {formatPrice(order.shipping_total, order.currency)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-2 font-mono text-caption font-bold text-right">
                    Total
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-caption font-bold">
                    {formatPrice(order.grand_total, order.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        {/* Tracking */}
        {tracking.length > 0 && (
          <Section title="Tracking">
            {tracking.map((t, i) => (
              <div key={i} className="font-body text-body text-ink">
                <span className="font-mono text-caption uppercase text-ink/50 mr-2">
                  {t.provider ?? "—"}
                </span>
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
                {t.source === "manual" && (
                  <span className="ml-2 font-mono text-[10px] text-ink/40 uppercase">manual</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Provider orders summary */}
        {providerOrders.length > 0 && (
          <Section title="Provider orders">
            {providerOrders.map((po, i) => (
              <div key={i} className="flex gap-4 font-mono text-caption">
                <span className="uppercase text-ink/50">{po.provider}</span>
                <span>{po.provider_order_id ?? "—"}</span>
                <span className="text-ink/40">{po.status ?? "—"}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Fulfilment attempt history */}
        <Section title="Fulfilment history">
          {attempts.length === 0 ? (
            <p className="font-body text-caption text-ink/50">No attempts recorded.</p>
          ) : (
            <div className="overflow-hidden rounded-sm border border-ink/10">
              <table className="w-full text-left">
                <thead className="bg-surface-2">
                  <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">Provider</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Provider ref</th>
                    <th className="px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-ink/10 font-body text-body text-ink">
                      <td className="px-4 py-2 font-mono text-caption text-ink/60 whitespace-nowrap">
                        {new Date(a.attempted_at).toLocaleString("en-GB")}
                      </td>
                      <td className="px-4 py-2 font-mono text-caption uppercase">
                        {a.provider ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-2 font-mono text-caption uppercase ${
                          a.status === "success" ? "text-ink/70" : "text-accent-sun"
                        }`}
                      >
                        {a.status}
                      </td>
                      <td className="px-4 py-2 font-mono text-caption text-ink/60">
                        {a.provider_order_id ?? "—"}
                      </td>
                      <td className="px-4 py-2 font-body text-caption text-ink/60 max-w-xs break-words">
                        {a.error_detail ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Manual fallback + retry — shown when attention is needed or the order
            was only fulfilled in dry-run mode (never sent to the provider). */}
        {showFulfilmentTools && (
          <Section title="Manual fallback">
            <p className="font-body text-caption text-ink/60 mb-4">
              {hasDryRun && !needsAttention
                ? "This order was processed in dry-run mode, so nothing was sent to the provider. Once live (fulfilment_dry_run off + API key set), use Retry to place it for real — the synthetic dry-run attempt is cleared first."
                : "Use this if you placed the order manually with the provider. Paste the provider reference and tracking number (if you have it). Or retry auto-fulfilment below."}
            </p>

            {providers.map((prov) => (
              <details key={prov} className="mb-4 rounded-sm border border-ink/10">
                <summary className="cursor-pointer px-4 py-3 font-mono text-caption tracking-wide text-ink uppercase">
                  Paste {prov} reference
                </summary>
                <form action={saveMannualFulfilment} className="px-4 pb-4 pt-3 space-y-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="provider" value={prov} />
                  <label className="block">
                    <span className="font-mono text-caption text-ink/60 uppercase">
                      {prov} order reference
                    </span>
                    <input
                      type="text"
                      name="provider_ref"
                      placeholder={prov === "printful" ? "e.g. 123456789" : "e.g. 5fdb..."}
                      className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-caption text-ink/60 uppercase">
                      Tracking number (optional)
                    </span>
                    <input
                      type="text"
                      name="tracking"
                      placeholder="e.g. JD0003...  or  1Z999..."
                      className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink"
                    />
                  </label>
                  <button className="rounded-sm bg-ink px-4 py-2 font-mono text-xs tracking-widest text-surface uppercase hover:bg-ink/80">
                    Save manual fulfilment
                  </button>
                </form>
              </details>
            ))}

            <form action={retryFulfilment}>
              <input type="hidden" name="order_id" value={order.id} />
              <button className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase">
                Retry auto-fulfilment
              </button>
            </form>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-mono text-caption tracking-wide text-ink/50 uppercase mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-caption tracking-wide text-ink/50 uppercase">{children}</p>;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`mt-0.5 text-body text-ink ${mono ? "font-mono text-caption" : "font-body"}`}>
        {value}
      </p>
    </div>
  );
}
