import { printfulHeaders } from "@/lib/shipping-printful";

// Minimal Printful Sync API client for importing store products into the
// catalogue. Sync products are the items you've set up in your Printful store;
// each sync_variant.id is the value passed when placing orders
// (order_items.provider_variant_id), so it's what fulfilment needs.

const BASE = "https://api.printful.com";

export function printfulConfigured(): boolean {
  return !!process.env.PRINTFUL_API_KEY;
}

export type SyncListItem = {
  id: number;
  name: string;
  thumbnail_url?: string;
  variants?: number;
};

export async function listSyncProducts(): Promise<SyncListItem[]> {
  const out: SyncListItem[] = [];
  let offset = 0;
  for (let guard = 0; guard < 50; guard++) {
    const res = await fetch(`${BASE}/sync/products?limit=100&offset=${offset}`, {
      headers: printfulHeaders(),
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

export async function getSyncProduct(id: string | number): Promise<SyncDetail> {
  const res = await fetch(`${BASE}/sync/products/${id}`, { headers: printfulHeaders() });
  if (!res.ok) throw new Error(`Printful ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return j.result as SyncDetail;
}
