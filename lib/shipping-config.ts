// Free-shipping threshold, in major currency units (e.g. 75 = £75). Configured
// via NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD so it's readable on both the client
// (cart progress messaging) and the server (the actual waiver at checkout) from
// a single source of truth. Unset / 0 / non-positive disables the feature
// entirely — no cart messaging and no waiver — so there's no surprise margin hit
// until the store explicitly opts in by setting the env var.
export const FREE_SHIPPING_THRESHOLD = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
})();

export function freeShippingEnabled(): boolean {
  return FREE_SHIPPING_THRESHOLD > 0;
}

// True once the items subtotal reaches the threshold (feature off → always false).
export function qualifiesForFreeShipping(subtotal: number): boolean {
  return freeShippingEnabled() && subtotal >= FREE_SHIPPING_THRESHOLD;
}

// How much more the shopper must spend to unlock free shipping (0 when already
// qualified or the feature is off).
export function amountToFreeShipping(subtotal: number): number {
  if (!freeShippingEnabled()) return 0;
  return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
}
