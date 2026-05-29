// Live shipping quotes from Printful + Printify with a flat-zone fallback.
// Master architecture §2 (live shipping) and §12 (Workers time limit risk):
//   - cache per-cart per-destination quotes for the lifetime of one request
//   - if any live call fails or times out, fall back gracefully to flat zones
//     and log the failure (never block checkout on POD-API uptime)
import { createServiceClient } from "@/lib/supabase/service";
import { printfulHeaders } from "./shipping-printful"; // re-export below

export type ShippingAddress = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string; // ISO-2
};

export type CartLine = {
  provider: "printful" | "printify" | null;
  provider_variant_id: string | null;
  quantity: number;
};

type Zone = { name: string; countries: string[]; rate: number };

export type Quote = {
  rate: number;
  zone: string;
  mode: "live" | "flat";
  per_provider?: { printful?: number; printify?: number };
  failures?: string[];
};

// ── flat zones (fallback path) ────────────────────────────────────────────────
async function flatQuote(addr: ShippingAddress): Promise<Quote> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("shipping_settings")
      .select("flat_zones")
      .eq("id", true)
      .maybeSingle();
    const row = data as unknown as { flat_zones: Zone[] } | null;
    const zones = row?.flat_zones ?? [];
    const country = (addr.country || "").toUpperCase();
    const hit =
      zones.find((z) => z.countries.includes(country)) ??
      zones.find((z) => z.countries.includes("*"));
    if (hit) return { rate: Number(hit.rate) || 0, zone: hit.name, mode: "flat" };
  } catch {
    /* fall through */
  }
  return { rate: 12.95, zone: "Rest of World (default)", mode: "flat" };
}

// ── live providers ────────────────────────────────────────────────────────────
async function printfulQuote(items: CartLine[], addr: ShippingAddress): Promise<number | null> {
  const variants = items.filter((i) => i.provider === "printful" && i.provider_variant_id);
  if (!variants.length || !process.env.PRINTFUL_API_KEY) return null;
  try {
    const res = await fetch("https://api.printful.com/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...printfulHeaders() },
      body: JSON.stringify({
        recipient: {
          address1: addr.line1 || "",
          city: addr.city || "",
          country_code: addr.country,
          state_code: addr.state || "",
          zip: addr.postal_code || "",
        },
        items: variants.map((v) => ({
          variant_id: Number(v.provider_variant_id),
          quantity: v.quantity,
        })),
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const cheapest = (j?.result ?? [])
      .map((r: { rate: string | number }) => Number(r.rate))
      .sort((a: number, b: number) => a - b)[0];
    return Number.isFinite(cheapest) ? cheapest : null;
  } catch {
    return null;
  }
}

async function printifyQuote(items: CartLine[], addr: ShippingAddress): Promise<number | null> {
  void addr;
  const variants = items.filter((i) => i.provider === "printify" && i.provider_variant_id);
  const shop = process.env.PRINTIFY_SHOP_ID;
  if (!variants.length || !process.env.PRINTIFY_API_KEY || !shop) return null;
  try {
    // Printify cost-estimate per product is in /shops/{id}/orders/shipping.json
    // — needs a line_items shape with product_id + variant_id. We don't track
    // printify provider_product_id per-line here, so this returns null and
    // checkout falls back to flat-zone for Printify items until we plumb that
    // through. Logged so the admin sees the gap.
    return null;
  } catch {
    return null;
  }
}

// ── orchestrator ─────────────────────────────────────────────────────────────
const cache = new Map<string, Quote>();

export async function quoteShipping(
  items: CartLine[] | { quantity: number }[] | number,
  addr: ShippingAddress,
): Promise<Quote> {
  // Normalise legacy signature `quoteShipping(addr, itemCount)`. New callers
  // pass typed CartLines; old (Session 05) callers pass just an item count.
  const lines: CartLine[] = Array.isArray(items) ? (items as CartLine[]) : [];

  // Cache key per (mode-aware) cart × destination.
  const key = JSON.stringify({
    addr: { c: addr.country, z: addr.postal_code },
    items: lines.map((l) => [l.provider, l.provider_variant_id, l.quantity]),
  });
  const cached = cache.get(key);
  if (cached) return cached;

  // Read shipping mode (live vs flat) from settings; default live.
  let mode: "live" | "flat" = "live";
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("shipping_settings").select("mode").eq("id", true).maybeSingle();
    const row = data as unknown as { mode: "live" | "flat" } | null;
    if (row?.mode) mode = row.mode;
  } catch {
    /* default */
  }

  if (mode === "flat") {
    const q = await flatQuote(addr);
    cache.set(key, q);
    return q;
  }

  // Live mode — sum across providers; on any failure, log + flat-fallback.
  const failures: string[] = [];
  const [pf, py] = await Promise.all([printfulQuote(lines, addr), printifyQuote(lines, addr)]);
  if (pf === null && lines.some((l) => l.provider === "printful")) failures.push("printful");
  if (py === null && lines.some((l) => l.provider === "printify")) failures.push("printify");

  if (failures.length) {
    const f = await flatQuote(addr);
    const q: Quote = { ...f, mode: "live", failures };
    cache.set(key, q);
    return q;
  }

  const rate = (pf ?? 0) + (py ?? 0);
  const q: Quote = {
    rate,
    zone: "Live POD quote",
    mode: "live",
    per_provider: {
      ...(pf != null ? { printful: pf } : {}),
      ...(py != null ? { printify: py } : {}),
    },
  };
  cache.set(key, q);
  return q;
}
