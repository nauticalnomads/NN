// POD-provider helpers used by the Shopify migration. CONTENT-SOURCE RULE: these
// helpers are used ONLY to derive provider mapping (which provider, IDs) and
// base_cost. They never produce titles, descriptions, images, or anything else
// that touches displayed content — that all comes from Shopify.

import { fetchWithRetry } from "./retry.mjs";

const PRINTFUL_BASE = "https://api.printful.com";
const PRINTIFY_BASE = "https://api.printify.com/v1";

// ── Printful ─────────────────────────────────────────────────────────────────
export function printfulHeaders() {
  const h = { Authorization: `Bearer ${process.env.PRINTFUL_API_KEY ?? ""}` };
  if (process.env.PRINTFUL_STORE_ID) h["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;
  return h;
}

// Catalog cost cache — many sync_variants share the same catalog variant_id,
// so we look each one up at most once across the whole migration.
const printfulCostCache = new Map();

export async function printfulCatalogCost(catalogVariantId) {
  if (!catalogVariantId) return null;
  if (printfulCostCache.has(catalogVariantId)) return printfulCostCache.get(catalogVariantId);
  try {
    const res = await fetchWithRetry(
      `${PRINTFUL_BASE}/products/variant/${encodeURIComponent(catalogVariantId)}`,
      { headers: printfulHeaders() },
      { label: "printful catalog" },
    );
    if (!res.ok) {
      printfulCostCache.set(catalogVariantId, null);
      return null;
    }
    const j = await res.json();
    const raw = j?.result?.variant?.price ?? j?.result?.price;
    const cost = typeof raw === "string" ? Number(raw) : raw;
    const value = Number.isFinite(cost) ? cost : null;
    printfulCostCache.set(catalogVariantId, value);
    return value;
  } catch {
    printfulCostCache.set(catalogVariantId, null);
    return null;
  }
}

// One-shot listing of every sync product in the connected store. Returns
// Map<shopifyLegacyProductId(string), { syncProduct, syncVariants[] }>.
// sync_variants[] each contain: id, external_id (shopify variant legacy id),
// variant_id (catalog variant id ⇒ provider_variant_id).
export async function buildPrintfulMap(progress = () => {}) {
  if (!process.env.PRINTFUL_API_KEY) return new Map();
  // 1) List all sync products (paginated).
  const list = [];
  let offset = 0;
  while (true) {
    const res = await fetchWithRetry(`${PRINTFUL_BASE}/sync/products?limit=100&offset=${offset}`, {
      headers: printfulHeaders(),
    });
    if (!res.ok) break;
    const j = await res.json();
    const page = j?.result ?? [];
    list.push(...page);
    if (page.length < 100) break;
    offset += 100;
    progress(`Printful list… ${list.length}`);
  }
  // 2) Detail-fetch each for sync_variants (where the catalog variant_id lives).
  const map = new Map();
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    try {
      const r = await fetchWithRetry(`${PRINTFUL_BASE}/sync/products/${p.id}`, {
        headers: printfulHeaders(),
      });
      if (!r.ok) continue;
      const dj = await r.json();
      const syncProduct = dj?.result?.sync_product;
      const syncVariants = dj?.result?.sync_variants ?? [];
      if (syncProduct?.external_id) {
        map.set(String(syncProduct.external_id), { syncProduct, syncVariants });
      }
    } catch {
      /* skip and continue */
    }
    if (i % 20 === 0) progress(`Printful detail ${i + 1}/${list.length}`);
  }
  return map;
}

// ── Printify ─────────────────────────────────────────────────────────────────
export async function buildPrintifyMap(progress = () => {}) {
  const key = process.env.PRINTIFY_API_KEY;
  const shop = process.env.PRINTIFY_SHOP_ID;
  if (!key || !shop) return new Map();
  const map = new Map();
  let page = 1;
  while (true) {
    const res = await fetchWithRetry(`${PRINTIFY_BASE}/shops/${shop}/products.json?limit=50&page=${page}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) break;
    const j = await res.json();
    const data = j?.data ?? [];
    for (const p of data) {
      if (p?.external?.id) map.set(String(p.external.id), p);
    }
    progress(`Printify list… ${map.size}`);
    if (data.length < 50) break;
    page++;
  }
  return map;
}
