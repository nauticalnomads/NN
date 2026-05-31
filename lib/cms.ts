import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";

// CMS key/value store (redesign v2 §3.3). Homepage images/copy, mega-menu
// images, footer tags. Public-read RLS, so storefront reads use the anon client.
// Values are arbitrary JSON shapes per key (see callers). Degrades to defaults
// if the table/row is missing so the site renders before the migration runs.

export type CmsValue = Record<string, unknown>;

// Read one key. Returns null if missing or backend unavailable.
export async function getCmsValue<T = CmsValue>(key: string): Promise<T | null> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.from("cms_content").select("value").eq("key", key).maybeSingle();
    return ((data as unknown as { value: T } | null)?.value ?? null) as T | null;
  } catch {
    return null;
  }
}

// Read many keys at once → map of key → value (missing keys omitted).
export async function getCmsValues(keys: string[]): Promise<Record<string, CmsValue>> {
  try {
    const sb = createPublicClient();
    const { data } = await sb.from("cms_content").select("key, value").in("key", keys);
    const rows = (data as unknown as Array<{ key: string; value: CmsValue }>) ?? [];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

// Write a key (admin only — uses the service client). Upserts.
export async function setCmsValue(key: string, value: CmsValue): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("cms_content")
    .upsert({ key, value, updated_at: new Date().toISOString() } as never);
}
