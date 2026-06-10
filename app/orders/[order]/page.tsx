import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { createServiceClient } from "@/lib/supabase/service";
import { confirmOrderFromSession } from "@/lib/orders";
import { getPurchasedGiftCardForOrder } from "@/lib/gift-cards";
import { formatPrice } from "@/lib/format";
import { ClearCart } from "./ClearCart";
import { RequestRefund } from "./RequestRefund";
import { StatusPoll } from "./StatusPoll";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

type OrderRow = {
  id: string;
  email: string;
  status: string;
  order_number: string | null;
  subtotal: number | null;
  shipping_total: number | null;
  discount_total: number | null;
  grand_total: number;
  currency: string;
  created_at: string;
};

type Item = {
  title: string;
  variant_title: string | null;
  quantity: number;
  unit_price: number;
  currency: string;
  product_id: string | null;
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ order: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { order } = await params;
  const { session_id } = await searchParams;
  const sb = createServiceClient();
  let row: OrderRow | null = null;
  let items: Item[] = [];
  const images = new Map<string, string>();

  try {
    const read = () =>
      sb
        .from("orders")
        .select(
          "id, email, status, order_number, subtotal, shipping_total, discount_total, grand_total, currency, created_at",
        )
        .eq("id", order)
        .maybeSingle();
    const { data } = await read();
    row = data as unknown as OrderRow | null;

    // Fallback confirmation: the webhook is the primary path, but if it's slow
    // or not yet configured, verify the Stripe session on return and flip the
    // order to paid. Idempotent and gated by the session's order_id.
    if (row && row.status !== "paid" && session_id) {
      await confirmOrderFromSession(order, session_id);
      const { data: fresh } = await read();
      if (fresh) row = fresh as unknown as OrderRow;
    }

    if (row) {
      const { data: itemData } = await sb
        .from("order_items")
        .select("title, variant_title, quantity, unit_price, currency, product_id")
        .eq("order_id", order)
        .order("created_at");
      items = (itemData as unknown as Item[]) ?? [];

      // Primary image per product, for thumbnails.
      const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
      if (productIds.length) {
        const { data: imgData } = await sb
          .from("product_images")
          .select("product_id, url, is_primary, sort_order")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });
        for (const im of (imgData as unknown as Array<{ product_id: string; url: string }>) ?? []) {
          if (!images.has(im.product_id)) images.set(im.product_id, im.url);
        }
      }
    }
  } catch {
    // Storefront is OK without Supabase; show 404.
  }
  if (!row) notFound();
  const r: OrderRow = row;
  const paid = r.status === "paid";

  let giftCard: Awaited<ReturnType<typeof getPurchasedGiftCardForOrder>> = null;
  if (paid) {
    try {
      giftCard = await getPurchasedGiftCardForOrder(r.id);
    } catch {
      // non-fatal
    }
  }

  const placed = new Date(r.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const itemsSubtotal = r.subtotal ?? items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discount = r.discount_total ?? 0;

  return (
    <Container className="py-16">
      {paid && <ClearCart />}
      {!paid && <StatusPoll paid={paid} />}

      {/* Hero */}
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-accent-sea/30 bg-accent-sea/10">
          {paid ? (
            <svg
              className="h-6 w-6 text-accent-sea"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              className="h-6 w-6 animate-spin text-accent-sea"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">
          Order received
        </p>
        <h1 className="mt-3 font-display text-display-2 tracking-tight text-ink">
          {paid ? "Thanks — that's in." : "Confirming your payment…"}
        </h1>
        <p className="mx-auto mt-4 max-w-md font-body text-body text-ink/70">
          {paid
            ? "We've emailed your receipt. You'll get a shipping confirmation with tracking the moment your order leaves the printer."
            : "Hang on a moment — this updates automatically. If it doesn't, check your email for the receipt."}
        </p>
      </div>

      {/* Receipt card */}
      <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-md border border-ink/10 bg-surface">
        {/* Meta strip */}
        <div className="flex flex-wrap gap-x-10 gap-y-3 border-b border-ink/10 bg-surface-2 px-6 py-4">
          <Meta label="Order">{r.order_number ?? r.id.slice(0, 8).toUpperCase()}</Meta>
          <Meta label="Date">{placed}</Meta>
          <Meta label="Email">{r.email}</Meta>
          <Meta label="Status">
            <span
              className={
                paid ? "text-accent-sea" : r.status === "refunded" ? "text-ink/50" : "text-ink"
              }
            >
              {r.status.replace(/_/g, " ").toUpperCase()}
            </span>
          </Meta>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <ul className="divide-y divide-ink/10 px-6">
            {items.map((i, idx) => {
              const img = i.product_id ? images.get(i.product_id) : undefined;
              return (
                <li key={idx} className="flex items-center gap-4 py-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-ink/10 bg-surface-2">
                    {img ? (
                      <Image src={img} alt={i.title} fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-lg text-ink/25">
                        NN
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-body text-ink">{i.title}</p>
                    {i.variant_title && (
                      <p className="font-body text-caption text-ink/50">{i.variant_title}</p>
                    )}
                    <p className="mt-0.5 font-mono text-caption text-ink/50">Qty {i.quantity}</p>
                  </div>
                  <span className="shrink-0 font-mono text-body text-ink">
                    {formatPrice(i.unit_price * i.quantity, i.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Totals */}
        <div className="space-y-2 border-t border-ink/10 px-6 py-5">
          <Row label="Subtotal" value={formatPrice(itemsSubtotal, r.currency)} />
          {discount > 0 && (
            <Row label="Discount" value={`− ${formatPrice(discount, r.currency)}`} accent />
          )}
          <Row
            label="Shipping"
            value={
              r.shipping_total && r.shipping_total > 0
                ? formatPrice(r.shipping_total, r.currency)
                : "Free"
            }
          />
          <div className="mt-2 flex justify-between border-t border-ink/10 pt-3 font-body text-body text-ink">
            <span className="font-medium">Total</span>
            <span className="font-mono font-medium">{formatPrice(r.grand_total, r.currency)}</span>
          </div>
        </div>
      </div>

      {/* Gift card code */}
      {giftCard && giftCard.status !== "pending" && (
        <div className="mx-auto mt-6 max-w-2xl rounded-md border border-accent-sea/30 bg-accent-sea/5 p-6 text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-accent-sea uppercase">
            Your gift card
          </p>
          <p className="mt-3 font-mono text-2xl tracking-[0.15em] text-ink">{giftCard.code}</p>
          <p className="mt-2 font-body text-caption text-ink/60">
            Balance {formatPrice(giftCard.balance, giftCard.currency)}
            {giftCard.expires_at
              ? ` · valid until ${new Date(giftCard.expires_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`
              : ""}
            . We&apos;ve emailed this to you too — enter it at checkout to redeem.
          </p>
        </div>
      )}

      {/* Next steps */}
      <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <Link
          href="/shop"
          className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90"
        >
          Continue shopping
        </Link>
        <Link
          href="/account"
          className="font-mono text-xs tracking-widest text-ink/60 uppercase transition-colors hover:text-accent-sun"
        >
          View your orders
        </Link>
      </div>

      {paid && (
        <div className="mx-auto mt-8 max-w-2xl text-center">
          <RequestRefund orderId={r.id} />
        </div>
      )}
    </Container>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.15em] text-ink/40 uppercase">{label}</p>
      <p className="mt-0.5 font-body text-caption text-ink">{children}</p>
    </div>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between font-body text-caption">
      <span className="text-ink/60">{label}</span>
      <span className={`font-mono ${accent ? "text-accent-sea" : "text-ink/80"}`}>{value}</span>
    </div>
  );
}
