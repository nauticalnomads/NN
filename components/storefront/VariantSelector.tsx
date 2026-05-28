"use client";

import { useMemo, useState } from "react";
import type { ProductWithRelations } from "@/lib/queries";
import { formatPrice } from "@/lib/format";

// Functional variant selection: choosing size/colour resolves the matching
// variant and reflects its price. The add-to-bag action is wired up in
// Session 05 (cart + checkout) — disabled here so the choice is honest.
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
          disabled
          title="Cart & checkout arrive in Session 05"
          className="w-full cursor-not-allowed rounded-sm bg-accent-sun px-6 py-4 font-mono text-xs tracking-widest text-surface uppercase opacity-70"
        >
          Add to bag — coming soon
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
