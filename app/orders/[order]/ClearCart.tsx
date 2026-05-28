"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";

// Empty the cart as soon as the user lands on a successful order page.
export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
