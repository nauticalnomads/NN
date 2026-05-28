"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartIcon() {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      className="relative font-mono text-xs tracking-wide text-ink uppercase no-underline transition-colors hover:text-accent-sun"
    >
      Bag{itemCount > 0 && <span className="ml-1 text-accent-sun">({itemCount})</span>}
    </Link>
  );
}
