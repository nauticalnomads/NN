"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import type { ProductWithRelations } from "@/lib/product";

// Client wishlist grid (§10). The wishlist ids live in the provider
// (localStorage for guests, Supabase-synced for signed-in). We hydrate product
// data from /api/products/by-ids, then render the standard ProductCard so the
// heart toggle + quick-add work exactly as elsewhere.
export function WishlistGrid() {
  const { items } = useWishlist();
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = items.map((i) => i.productId);
  const idKey = ids.slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/products/by-ids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const fetched = (data?.products ?? []) as ProductWithRelations[];
        // Preserve wishlist order.
        const order = new Map(ids.map((id, i) => [id, i]));
        fetched.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        setProducts(fetched);
      })
      .catch(() => setProducts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  if (loading) {
    return (
      <p className="py-16 text-center font-body text-body text-ink/50">Loading your wishlist…</p>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-ink/20 py-20 text-center">
        <p className="font-body text-body text-ink/55">
          Your wishlist is empty.{" "}
          <Link href="/shop" className="text-terracotta no-underline hover:underline">
            Start exploring →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
