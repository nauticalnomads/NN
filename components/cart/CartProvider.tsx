"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type CartItem = {
  variantId: string; // DB variant uuid
  productId: string; // DB product uuid (for analytics + dedup)
  slug: string; // for linking back
  title: string; // snapshot at add time
  variantTitle: string | null;
  sku: string;
  price: number; // unit price
  currency: string;
  imageUrl: string | null;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (variantId: string) => void;
  setQuantity: (variantId: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
  itemCount: number;
};

const Ctx = createContext<CartState | null>(null);
const KEY = "nn_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore corruption */
    }
  }, []);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* quota */
    }
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((curr) => {
      const i = curr.findIndex((c) => c.variantId === item.variantId);
      if (i >= 0) {
        const next = [...curr];
        next[i] = { ...next[i], quantity: next[i].quantity + item.quantity };
        return next;
      }
      return [...curr, item];
    });
  }, []);

  const remove = useCallback((variantId: string) => {
    setItems((curr) => curr.filter((c) => c.variantId !== variantId));
  }, []);

  const setQuantity = useCallback((variantId: string, qty: number) => {
    setItems((curr) =>
      curr
        .map((c) => (c.variantId === variantId ? { ...c, quantity: Math.max(0, qty) } : c))
        .filter((c) => c.quantity > 0),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Ctx.Provider value={{ items, add, remove, setQuantity, clear, subtotal, itemCount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}
