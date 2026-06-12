"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/format";

// "Recently viewed" rail, backed by localStorage (same nn_*_v1 + silent
// try/catch conventions as the cart store). The PDP mounts this with the
// current product, which is recorded on view and excluded from its own rail.
const KEY = "nn_recently_viewed_v1";
const MAX = 12;

export type ViewedProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  imageUrl: string | null;
};

function read(): ViewedProduct[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function RecentlyViewed({ current }: { current: ViewedProduct }) {
  const [items, setItems] = useState<ViewedProduct[]>([]);

  useEffect(() => {
    const prev = read().filter((p) => p.id !== current.id);
    setItems(prev.slice(0, 8));
    try {
      localStorage.setItem(KEY, JSON.stringify([current, ...prev].slice(0, MAX)));
    } catch {
      /* quota */
    }
  }, [current]);

  if (items.length === 0) return null;

  return (
    <section className="mt-16 border-t border-ink/10 pt-10">
      <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">
        Recently viewed
      </h2>
      <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.slug}`}
            className="w-36 shrink-0 no-underline sm:w-44"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-surface-2">
              {p.imageUrl ? (
                <Image src={p.imageUrl} alt={p.title} fill sizes="176px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="font-display text-3xl text-ink/15">N</span>
                </div>
              )}
            </div>
            <p className="mt-2 truncate font-body text-caption text-ink">{p.title}</p>
            <p className="font-mono text-caption text-ink/60">{formatPrice(p.price, p.currency)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
