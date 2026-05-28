// Tiny leaf module so shipping.ts can pull Printful auth headers without
// importing scripts/lib/providers.mjs (which is .mjs and outside the
// TypeScript-compiled tree).
export function printfulHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY ?? ""}`,
  };
  if (process.env.PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;
  return h;
}
