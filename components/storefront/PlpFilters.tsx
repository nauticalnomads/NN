"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { ProductWithRelations } from "@/lib/product";

// PLP filter sidebar + grid (redesign v2 §5.3/§5.4). Filters operate client-side
// on the already-fetched collection products: colour, size, price, sort. Mobile
// shows a "Filter" button that opens the panel as a drawer.

type Sort = "featured" | "newest" | "price_asc" | "price_desc";

function Group({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink/10 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between font-body text-[14px] font-semibold text-deep-ink"
      >
        {label}
        <span className="text-ink/50">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function PlpFilters({ products }: { products: ProductWithRelations[] }) {
  const allColours = useMemo(
    () =>
      [
        ...new Set(products.flatMap((p) => p.variants.map((v) => v.color).filter(Boolean))),
      ] as string[],
    [products],
  );
  const allSizes = useMemo(
    () =>
      [
        ...new Set(products.flatMap((p) => p.variants.map((v) => v.size).filter(Boolean))),
      ] as string[],
    [products],
  );
  const maxPrice = useMemo(
    () => Math.ceil(Math.max(50, ...products.map((p) => p.price))),
    [products],
  );

  const [colours, setColours] = useState<Set<string>>(new Set());
  const [sizes, setSizes] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState(maxPrice);
  const [sort, setSort] = useState<Sort>("featured");
  const [drawer, setDrawer] = useState(false);

  const toggle = (set: Set<string>, val: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(val)) n.delete(val);
    else n.add(val);
    fn(n);
  };

  const filtered = useMemo(() => {
    let r = products.filter((p) => {
      if (price < maxPrice && p.price > price) return false;
      if (colours.size && !p.variants.some((v) => v.color && colours.has(v.color))) return false;
      if (sizes.size && !p.variants.some((v) => v.size && sizes.has(v.size))) return false;
      return true;
    });
    if (sort === "price_asc") r = [...r].sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") r = [...r].sort((a, b) => b.price - a.price);
    else if (sort === "newest")
      r = [...r].sort(
        (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
      );
    return r;
  }, [products, colours, sizes, price, sort, maxPrice]);

  const filters = (
    <div>
      <Group label="Sort by">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="w-full rounded-sm border border-ink/20 bg-surface px-2 py-1.5 font-body text-[14px]"
        >
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </Group>
      {allColours.length > 0 && (
        <Group label="Colour">
          <div className="flex flex-wrap gap-1.5">
            {allColours.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(colours, c, setColours)}
                className={`rounded-sm border px-2 py-1 font-body text-[13px] capitalize ${
                  colours.has(c)
                    ? "border-deep-ink bg-deep-ink text-hull-white"
                    : "border-ink/30 text-deep-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Group>
      )}
      {allSizes.length > 0 && (
        <Group label="Size">
          <div className="flex flex-wrap gap-1.5">
            {allSizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(sizes, s, setSizes)}
                className={`min-w-9 rounded-sm border px-2 py-1 font-body text-[13px] uppercase ${
                  sizes.has(s)
                    ? "border-deep-ink bg-deep-ink text-hull-white"
                    : "border-ink/30 text-deep-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Group>
      )}
      <Group label="Price">
        <input
          type="range"
          min={0}
          max={maxPrice}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full accent-terracotta"
        />
        <p className="mt-1 font-body text-[13px] text-ink/60">Up to £{price}</p>
      </Group>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="rounded-sm border border-ink/20 px-4 py-2 font-body text-[13px] text-deep-ink lg:hidden"
        >
          Filter
        </button>
        <p className="ml-auto font-body text-[13px] text-driftwood-tan">
          {filtered.length} results
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">{filters}</aside>

        <div>
          {filtered.length === 0 ? (
            <p className="py-16 text-center font-body text-body text-ink/50">
              Nothing matches those filters.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-deep-ink/40"
            onClick={() => setDrawer(false)}
            aria-hidden
          />
          <div className="absolute right-0 bottom-0 left-0 max-h-[80vh] overflow-y-auto rounded-t-lg bg-hull-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-body text-[16px] font-semibold text-deep-ink">Filter</p>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="text-deep-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {filters}
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="mt-4 w-full rounded-sm bg-terracotta py-3 font-body text-[14px] font-medium text-hull-white"
            >
              Show {filtered.length} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
