"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

// Wishlist (redesign v2 §10). Guests: localStorage. Logged-in: synced to the
// `wishlists` table via /api/wishlist. On sign-in the client merges local →
// server (handled in WishlistProvider mount). Keyed by product id; variant id
// optional (first variant by default).

export type WishItem = { productId: string; variantId?: string | null };

type WishState = {
  items: WishItem[];
  has: (productId: string) => boolean;
  toggle: (item: WishItem) => void;
  remove: (productId: string) => void;
  count: number;
};

const Ctx = createContext<WishState | null>(null);
const KEY = "nn_wishlist";

export function WishlistProvider({
  children,
  signedIn = false,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
}) {
  const [items, setItems] = useState<WishItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load: localStorage first, then (if signed in) merge with server.
  useEffect(() => {
    let local: WishItem[] = [];
    try {
      local = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      local = [];
    }
    if (!signedIn) {
      setItems(local);
      setLoaded(true);
      return;
    }
    // Signed in: push local up, then read merged set back.
    (async () => {
      try {
        if (local.length) {
          await fetch("/api/wishlist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ merge: local }),
          });
        }
        const res = await fetch("/api/wishlist");
        const data = await res.json().catch(() => ({ items: [] }));
        setItems(Array.isArray(data.items) ? data.items : local);
      } catch {
        setItems(local);
      } finally {
        setLoaded(true);
      }
    })();
  }, [signedIn]);

  // Persist to localStorage (always — also acts as offline cache when signed in).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore quota */
    }
  }, [items, loaded]);

  const has = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items],
  );

  const toggle = useCallback(
    (item: WishItem) => {
      setItems((cur) => {
        const exists = cur.some((i) => i.productId === item.productId);
        const next = exists ? cur.filter((i) => i.productId !== item.productId) : [...cur, item];
        if (signedIn) {
          const method = exists ? "DELETE" : "POST";
          fetch("/api/wishlist", {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              product_id: item.productId,
              variant_id: item.variantId ?? null,
            }),
          }).catch(() => undefined);
        }
        return next;
      });
    },
    [signedIn],
  );

  const remove = useCallback(
    (productId: string) => {
      setItems((cur) => cur.filter((i) => i.productId !== productId));
      if (signedIn) {
        fetch("/api/wishlist", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        }).catch(() => undefined);
      }
    },
    [signedIn],
  );

  return (
    <Ctx.Provider value={{ items, has, toggle, remove, count: items.length }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
