"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { ProductWithRelations } from "@/lib/product";
import { primaryImage } from "@/lib/product";
import { formatPrice, isOnSale } from "@/lib/format";
import { useCart } from "@/components/cart/CartProvider";
import { useWishlist } from "@/components/wishlist/WishlistProvider";

// NEW if published within the last 30 days (redesign v2 §4.2).
function isNew(publishedAt: string | null) {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() < 30 * 24 * 60 * 60 * 1000;
}

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const img = primaryImage(product);
  const onSale = isOnSale(product.price, product.compare_at_price);
  const isNewProduct = isNew(product.published_at);
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const wished = has(product.id);

  const variants = product.variants ?? [];
  const sizes = variants.filter((v) => v.size);
  const colours = new Set(variants.map((v) => v.color).filter(Boolean));
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0].id : null);

  function addToCart(variantId: string) {
    const v = variants.find((x) => x.id === variantId) ?? variants[0];
    if (!v) return;
    add({
      variantId: v.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      variantTitle: v.title ?? ([v.color, v.size].filter(Boolean).join(" / ") || null),
      sku: v.sku,
      price: v.price ?? product.price,
      currency: product.currency,
      imageUrl: img?.url ?? null,
      quantity: 1,
    });
  }

  const singleVariant = variants.length === 1;

  return (
    <div className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-surface-2">
        <Link href={`/products/${product.slug}`} className="block h-full no-underline">
          {img ? (
            <Image
              src={img.url}
              alt={img.alt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-display text-3xl text-ink/15">NN</span>
            </div>
          )}
        </Link>

        {/* Badges */}
        {isNewProduct && (
          <span className="absolute top-3 left-3 rounded-full bg-deep-ink px-2.5 py-1 font-body text-[10px] font-semibold tracking-wide text-hull-white uppercase">
            New
          </span>
        )}
        {onSale && !isNewProduct && (
          <span className="absolute top-3 left-3 rounded-full bg-terracotta px-2.5 py-1 font-body text-[10px] font-semibold tracking-wide text-hull-white uppercase">
            Sale
          </span>
        )}

        {/* Wishlist heart */}
        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          onClick={() => toggle({ productId: product.id, variantId: variants[0]?.id ?? null })}
          className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-hull-white/85 text-deep-ink transition-colors hover:text-terracotta md:opacity-0 md:group-hover:opacity-100"
        >
          <svg
            className="h-[18px] w-[18px]"
            viewBox="0 0 24 24"
            fill={wished ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.6"
            style={wished ? { color: "var(--accent-sun)" } : undefined}
          >
            <path d="M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.6 12 20 12 20Z" />
          </svg>
        </button>

        {/* Quick-add — slides up on hover (desktop) */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-hull-white/95 p-3 transition-transform duration-200 ease-out group-hover:translate-y-0 max-md:hidden">
          {!singleVariant && sizes.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {sizes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSize(v.id)}
                  className={`min-w-8 rounded-sm border px-2 py-1 font-body text-[12px] ${
                    size === v.id
                      ? "border-deep-ink bg-deep-ink text-hull-white"
                      : "border-ink/30 text-deep-ink hover:border-deep-ink"
                  }`}
                >
                  {v.size}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={!singleVariant && sizes.length > 0 && !size}
            onClick={() => addToCart(singleVariant ? variants[0].id : (size ?? variants[0]?.id))}
            className="w-full rounded-sm bg-terracotta py-2 font-body text-[13px] font-medium text-hull-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {!singleVariant && sizes.length > 0 && !size ? "Select a size" : "Add to cart"}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-3">
        {colours.size > 0 && (
          <div className="mb-1 flex gap-1">
            {Array.from({ length: Math.min(colours.size, 5) }).map((_, i) => (
              <span key={i} className="h-2 w-2 rounded-full border border-ink/20 bg-surface-2" />
            ))}
          </div>
        )}
        <Link href={`/products/${product.slug}`} className="no-underline">
          <h3 className="font-body text-[14px] font-semibold text-deep-ink hover:text-terracotta">
            {product.title}
          </h3>
        </Link>
        <span className="font-body text-[14px] font-semibold text-deep-ink">
          {onSale && (
            <span className="mr-2 font-normal text-ink/40 line-through">
              {formatPrice(product.compare_at_price, product.currency)}
            </span>
          )}
          {formatPrice(product.price, product.currency)}
        </span>
      </div>
    </div>
  );
}
