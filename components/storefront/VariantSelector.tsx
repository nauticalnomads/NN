"use client";

import { useMemo, useState } from "react";
import type { ProductWithRelations } from "@/lib/product";
import { formatPrice } from "@/lib/format";
import { primaryImage } from "@/lib/product";
import { useCart } from "@/components/cart/CartProvider";

// Functional variant selection: choosing size/colour resolves the matching
// variant and reflects its price. Add-to-bag pushes the immutable snapshot
// (price, sku, provider ids) into the cart store so checkout can build the
// order without re-reading live product data.
export function VariantSelector({ product }: { product: ProductWithRelations }) {
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))],
    [variants],
  );
  const colors = useMemo(
    () => [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))],
    [variants],
  );

  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(colors[0] ?? null);

  const selected =
    variants.find(
      (v) => (sizes.length ? v.size === size : true) && (colors.length ? v.color === color : true),
    ) ??
    variants[0] ??
    null;

  const price = selected?.price ?? product.price;
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const img = primaryImage(product);

  function addToBag() {
    if (!selected) return;
    cart.add({
      variantId: selected.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      variantTitle:
        (selected.title ?? [selected.size, selected.color].filter(Boolean).join(" / ")) || null,
      sku: selected.sku,
      price: selected.price,
      currency: product.currency,
      imageUrl: img?.url ?? null,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="space-y-6">
      <p className="font-mono text-sub text-ink">{formatPrice(price, product.currency)}</p>

      {sizes.length > 0 && <Picker label="Size" options={sizes} value={size} onChange={setSize} />}
      {colors.length > 0 && (
        <Picker label="Colour" options={colors} value={color} onChange={setColor} />
      )}

      <div>
        <button
          type="button"
          onClick={addToBag}
          disabled={!selected}
          className="w-full rounded-sm bg-accent-sun px-6 py-4 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {added ? "Added to bag ✓" : "Add to bag"}
        </button>
        {selected?.sku && (
          <p className="mt-3 font-mono text-caption text-ink/40">SKU {selected.sku}</p>
        )}
      </div>
    </div>
  );
}

function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={value === opt}
            className={`min-w-12 rounded-sm border px-4 py-2 font-mono text-caption uppercase transition-colors ${
              value === opt
                ? "border-ink bg-ink text-surface"
                : "border-ink/25 text-ink hover:border-ink"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
