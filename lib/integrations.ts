import { createServiceClient } from "@/lib/supabase/service";

// Single source of truth for POD provider credentials. Values are read from
// store_settings (editable in /admin/settings) and fall back to the Cloudflare
// Worker env vars, so existing deployments keep working until DB values are set.
// Server-only (uses the service client) — never import from client components.

export type IntegrationConfig = {
  printful: { apiKey: string; storeId: string; webhookSecret: string };
  printify: { apiKey: string; shopId: string; webhookSecret: string };
};

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  let row: Record<string, unknown> = {};
  try {
    const sb = createServiceClient();
    // select("*") tolerates the columns not existing yet (pre-migration).
    const { data } = await sb.from("store_settings").select("*").eq("id", true).maybeSingle();
    row = (data as unknown as Record<string, unknown> | null) ?? {};
  } catch {
    row = {};
  }
  const pick = (col: string, env: string): string => {
    const v = row[col];
    if (typeof v === "string" && v.trim()) return v.trim();
    return process.env[env] ?? "";
  };
  return {
    printful: {
      apiKey: pick("printful_api_key", "PRINTFUL_API_KEY"),
      storeId: pick("printful_store_id", "PRINTFUL_STORE_ID"),
      webhookSecret: pick("printful_webhook_secret", "PRINTFUL_WEBHOOK_SECRET"),
    },
    printify: {
      apiKey: pick("printify_api_key", "PRINTIFY_API_KEY"),
      shopId: pick("printify_shop_id", "PRINTIFY_SHOP_ID"),
      webhookSecret: pick("printify_webhook_secret", "PRINTIFY_WEBHOOK_SECRET"),
    },
  };
}

// Printful auth headers from the resolved config (store id optional override).
export async function printfulAuthHeaders(
  storeIdOverride?: string,
): Promise<Record<string, string>> {
  const { printful } = await getIntegrationConfig();
  const h: Record<string, string> = { Authorization: `Bearer ${printful.apiKey}` };
  const sid = storeIdOverride || printful.storeId;
  if (sid) h["X-PF-Store-Id"] = sid;
  return h;
}
