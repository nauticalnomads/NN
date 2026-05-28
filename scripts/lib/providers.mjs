// Thin POD API wrappers used by the migration to fetch base_cost per variant
// and to verify provider/variant IDs exist. Either provider can be absent —
// callers should treat missing creds as "no base cost available, flag it".

const PRINTFUL_BASE = "https://api.printful.com";
const PRINTIFY_BASE = "https://api.printify.com/v1";

export async function printfulVariantCost(printfulVariantId) {
  const key = process.env.PRINTFUL_API_KEY;
  if (!key || !printfulVariantId) return null;
  const res = await fetch(`${PRINTFUL_BASE}/products/variant/${encodeURIComponent(printfulVariantId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  // Printful price is the catalogue price you pay them, as a numeric string.
  const price = json?.result?.variant?.price ?? json?.result?.price;
  const n = typeof price === "string" ? Number(price) : price;
  return Number.isFinite(n) ? n : null;
}

export async function printifyVariantCost(shopId, printifyProductId, printifyVariantId) {
  const key = process.env.PRINTIFY_API_KEY;
  if (!key || !shopId || !printifyProductId || !printifyVariantId) return null;
  const res = await fetch(`${PRINTIFY_BASE}/shops/${shopId}/products/${printifyProductId}.json`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const variant = (json.variants ?? []).find((v) => String(v.id) === String(printifyVariantId));
  // Printify variant cost is in minor units (cents/pence).
  const cents = variant?.cost ?? variant?.price;
  return Number.isFinite(cents) ? cents / 100 : null;
}

export async function fetchBaseCost(provider, providerVariantId, providerProductId) {
  try {
    if (provider === "printful") return await printfulVariantCost(providerVariantId);
    if (provider === "printify") {
      const shopId = process.env.PRINTIFY_SHOP_ID;
      return await printifyVariantCost(shopId, providerProductId, providerVariantId);
    }
  } catch {
    // Network/API hiccup — the migration flags it rather than failing the run.
  }
  return null;
}
