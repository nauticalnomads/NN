"use client";

import { useRef } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { ProductWithRelations } from "@/lib/product";

// Horizontal product carousel (redesign v2 §4.2). Heading left, prev/next
// arrows right, scroll-snap row of product cards. Quick-add hover lives in the
// ProductCard itself (Phase 6); this is the layout shell.
export function FeaturedCarousel({
  heading,
  products,
}: {
  heading: string;
  products: ProductWithRelations[];
}) {
  const scroller = useRef<HTMLDivElement>(null);

  if (products.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 600), behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-12 lg:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="font-body text-[22px] font-bold text-deep-ink">{heading}</h2>
        <div className="flex gap-2">
          {[-1, 1].map((d) => (
            <button
              key={d}
              type="button"
              aria-label={d === -1 ? "Previous" : "Next"}
              onClick={() => scroll(d as 1 | -1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-deep-ink/20 text-deep-ink transition-colors hover:border-terracotta hover:text-terracotta-text"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d={d === -1 ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[23%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
