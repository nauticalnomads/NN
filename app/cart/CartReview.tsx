"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/components/cart/CartProvider";
import { formatPrice } from "@/lib/format";

export function CartReview() {
  const { items, setQuantity, remove, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="mt-12 rounded-sm border border-dashed border-ink/20 py-20 text-center">
        <p className="font-body text-body text-ink/60">Nothing in your bag yet.</p>
        <Link
          href="/shop"
          className="mt-4 inline-block font-mono text-caption tracking-widest text-accent-sun uppercase underline-offset-4 hover:underline"
        >
          Browse the shop →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y divide-ink/10">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-5 py-5">
            <Link
              href={`/products/${item.slug}`}
              className="relative block h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-surface-2"
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : null}
            </Link>
            <div className="flex flex-1 flex-col">
              <div className="flex justify-between gap-3">
                <div>
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-body text-body text-ink hover:text-accent-sun"
                  >
                    {item.title}
                  </Link>
                  {item.variantTitle && (
                    <p className="font-mono text-caption text-ink/50">{item.variantTitle}</p>
                  )}
                  <p className="mt-1 font-mono text-caption text-ink/40">SKU {item.sku}</p>
                </div>
                <p className="shrink-0 font-mono text-body text-ink">
                  {formatPrice(item.price * item.quantity, item.currency)}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-3">
                <div className="inline-flex items-center rounded-sm border border-ink/20">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                    className="px-3 py-1 font-mono text-caption text-ink hover:bg-surface-2"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="min-w-8 px-3 text-center font-mono text-caption">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                    className="px-3 py-1 font-mono text-caption text-ink hover:bg-surface-2"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.variantId)}
                  className="font-mono text-caption tracking-wide text-ink/50 uppercase underline-offset-4 hover:text-accent-sun hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-sm border border-ink/10 bg-surface-2 p-6">
        <h2 className="font-mono text-caption tracking-wide text-ink/50 uppercase">Summary</h2>
        <div className="mt-4 flex items-baseline justify-between font-body text-body text-ink">
          <span>Subtotal</span>
          <span className="font-mono">{formatPrice(subtotal, items[0]?.currency ?? "GBP")}</span>
        </div>
        <p className="mt-1 font-mono text-caption text-ink/50">
          Shipping calculated at checkout. No VAT charged.
        </p>
        <Link
          href="/checkout"
          className="mt-6 block rounded-sm bg-accent-sun py-3 text-center font-mono text-xs tracking-widest text-surface uppercase no-underline transition-opacity hover:opacity-90"
        >
          Checkout →
        </Link>
        <Link
          href="/shop"
          className="mt-3 block text-center font-mono text-caption tracking-widest text-ink/60 uppercase underline-offset-4 hover:underline"
        >
          Keep shopping
        </Link>
      </aside>
    </div>
  );
}
