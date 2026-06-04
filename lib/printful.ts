// Minimal Printful Sync API client for importing store products into the
// catalogue. Sync products are the items you've set up in your Printful store;
// each sync_variant.id is the value passed when placing orders
// (order_items.provider_variant_id), so it's what fulfilment needs.

const BASE = "https://api.printful.com";

export function printfulConfigured(): boolean {
  return !!process.env.PRINTFUL_API_KEY;
}

// X-PF-Store-Id is only required for account-level tokens that span multiple
// stores. Store-level tokens don't need it. We pass an explicit storeId when
// we've resolved one (env var or auto-detected single store).
function headers(storeId?: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY ?? ""}`,
  };
  const sid = storeId || process.env.PRINTFUL_STORE_ID;
  if (sid) h["X-PF-Store-Id"] = sid;
  return h;
}

export type PrintfulStore = { id: number; name: string; type?: string };

// List the stores the token can access. Also doubles as a connection check.
export async function getStores(): Promise<PrintfulStore[]> {
  const res = await fetch(`${BASE}/stores`, { headers: headers() });
  if (!res.ok) throw new Error(`Printful ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return (j?.result ?? []) as PrintfulStore[];
}

// Resolve the store id to use: explicit env var, else the single accessible
// store. Returns null when the token is already store-scoped (no /stores needed)
// or when it can't be determined; throws a helpful error on multiple stores.
export async function resolveStoreId(): Promise<string | null> {
  if (process.env.PRINTFUL_STORE_ID) return process.env.PRINTFUL_STORE_ID;
  let stores: PrintfulStore[] = [];
  try {
    stores = await getStores();
  } catch {
    return null; // store-scoped token: /stores may 401; the import works without it
  }
  if (stores.length === 1) return String(stores[0].id);
  if (stores.length > 1) {
    const list = stores.map((s) => `${s.name} (${s.id})`).join(", ");
    throw new Error(`Token covers multiple stores — set PRINTFUL_STORE_ID to one of: ${list}`);
  }
  return null;
}

export type SyncListItem = {
  id: number;
  name: string;
  thumbnail_url?: string;
  variants?: number;
};

export async function listSyncProducts(storeId?: string): Promise<SyncListItem[]> {
  const out: SyncListItem[] = [];
  let offset = 0;
  for (let guard = 0; guard < 50; guard++) {
    const res = await fetch(`${BASE}/sync/products?limit=100&offset=${offset}`, {
      headers: headers(storeId),
    });
    if (!res.ok) throw new Error(`Printful ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const j = await res.json();
    const items = (j?.result ?? []) as SyncListItem[];
    out.push(...items);
    const total = j?.paging?.total ?? out.length;
    offset += items.length;
    if (items.length === 0 || offset >= total) break;
  }
  return out;
}

export type SyncVariant = {
  id: number;
  name?: string;
  sku?: string;
  retail_price?: string;
  currency?: string;
  variant_id?: number;
  product?: { image?: string };
  files?: { type: string; preview_url?: string }[];
};
export type SyncDetail = {
  sync_product: { id: number; name: string; thumbnail_url?: string };
  sync_variants: SyncVariant[];
};

export async function getSyncProduct(id: string | number, storeId?: string): Promise<SyncDetail> {
  const res = await fetch(`${BASE}/sync/products/${id}`, { headers: headers(storeId) });
  if (!res.ok) throw new Error(`Printful ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return j.result as SyncDetail;
}
