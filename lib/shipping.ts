// Live shipping quotes from Printful + Printify with a flat-zone fallback.
// Master architecture §2 (live shipping) and §12 (Workers time limit risk):
//   - cache per-cart per-destination quotes for the lifetime of one request
//   - if any live call fails or times out, fall back gracefully to flat zones
//     and log the failure (never block checkout on POD-API uptime)
import { createServiceClient } from "@/lib/supabase/service";
import { getIntegrationConfig, printfulAuthHeaders } from "@/lib/integrations";

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
  provider_product_id: string | null; // needed for Printify shipping quote + fulfilment
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
  const { printful } = await getIntegrationConfig();
  if (!variants.length || !printful.apiKey) return null;
  try {
    const res = await fetch("https://api.printful.com/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await printfulAuthHeaders()) },
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
  const lines = items.filter(
    (i) => i.provider === "printify" && i.provider_product_id && i.provider_variant_id,
  );
  const { printify } = await getIntegrationConfig();
  const shop = printify.shopId;
  if (!lines.length || !printify.apiKey || !shop) return null;
  try {
    const [first = "", ...rest] = (addr.name ?? "").split(" ");
    const res = await fetch(`https://api.printify.com/v1/shops/${shop}/orders/shipping.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${printify.apiKey}`,
      },
      body: JSON.stringify({
        line_items: lines.map((l) => ({
          product_id: l.provider_product_id,
          variant_id: Number(l.provider_variant_id),
          quantity: l.quantity,
        })),
        address_to: {
          first_name: first,
          last_name: rest.join(" "),
          email: "shipping-quote@example.invalid",
          country: addr.country,
          region: addr.state ?? "",
          address1: addr.line1 ?? "",
          address2: addr.line2 ?? "",
          city: addr.city ?? "",
          zip: addr.postal_code ?? "",
        },
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, number>;
    // Response: { standard, express, priority, printify_express, economy } in cents.
    const candidates = ["standard", "economy", "express", "priority", "printify_express"]
      .map((k) => j[k])
      .filter((n): n is number => typeof n === "number" && n > 0);
    if (!candidates.length) return null;
    return Math.min(...candidates) / 100; // cheapest, in major units
  } catch {
    return null;
  }
}

// ── orchestrator ─────────────────────────────────────────────────────────────
// Per-(cart × destination) quote cache. Entries expire so a shipping-settings
// change (flat zones / mode) is picked up within QUOTE_TTL_MS rather than living
// for the whole isolate lifetime.
const QUOTE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { q: Quote; exp: number }>();
function cacheGet(key: string): Quote | null {
  const e = cache.get(key);
  if (e && e.exp > Date.now()) return e.q;
  if (e) cache.delete(key);
  return null;
}
function cacheSet(key: string, q: Quote): Quote {
  cache.set(key, { q, exp: Date.now() + QUOTE_TTL_MS });
  return q;
}

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
  const cached = cacheGet(key);
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
    return cacheSet(key, await flatQuote(addr));
  }

  // Live mode — sum across providers; on any failure, log + flat-fallback.
  const failures: string[] = [];
  const [pf, py] = await Promise.all([printfulQuote(lines, addr), printifyQuote(lines, addr)]);
  if (pf === null && lines.some((l) => l.provider === "printful")) failures.push("printful");
  if (py === null && lines.some((l) => l.provider === "printify")) failures.push("printify");

  if (failures.length) {
    const f = await flatQuote(addr);
    return cacheSet(key, { ...f, mode: "live", failures });
  }

  const rate = (pf ?? 0) + (py ?? 0);
  return cacheSet(key, {
    rate,
    zone: "Live POD quote",
    mode: "live",
    per_provider: {
      ...(pf != null ? { printful: pf } : {}),
      ...(py != null ? { printify: py } : {}),
    },
  });
}
