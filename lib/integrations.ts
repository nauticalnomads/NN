import { createServiceClient } from "@/lib/supabase/service";

// Single source of truth for integration credentials. Values are read from
// store_settings (editable in /admin/settings) and fall back to the Cloudflare
// Worker env vars, so existing deployments keep working until DB values are set.
// Server-only (uses the service client) — never import from client components.

export type IntegrationConfig = {
  printful: { apiKey: string; storeId: string; webhookSecret: string };
  printify: { apiKey: string; shopId: string; webhookSecret: string };
};

export type GoogleConfig = {
  serviceAccountJson: string;
  driveFolderId: string;
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
  // Static process.env references — dynamic process.env[key] does not resolve
  // reliably in the Cloudflare Workers runtime, so env fallback must be explicit.
  const env: Record<string, string | undefined> = {
    printful_api_key: process.env.PRINTFUL_API_KEY,
    printful_store_id: process.env.PRINTFUL_STORE_ID,
    printful_webhook_secret: process.env.PRINTFUL_WEBHOOK_SECRET,
    printify_api_key: process.env.PRINTIFY_API_KEY,
    printify_shop_id: process.env.PRINTIFY_SHOP_ID,
    printify_webhook_secret: process.env.PRINTIFY_WEBHOOK_SECRET,
  };
  const pick = (col: string): string => {
    const v = row[col];
    if (typeof v === "string" && v.trim()) return v.trim();
    return env[col] ?? "";
  };
  return {
    printful: {
      apiKey: pick("printful_api_key"),
      storeId: pick("printful_store_id"),
      webhookSecret: pick("printful_webhook_secret"),
    },
    printify: {
      apiKey: pick("printify_api_key"),
      shopId: pick("printify_shop_id"),
      webhookSecret: pick("printify_webhook_secret"),
    },
  };
}

export async function getGoogleConfig(): Promise<GoogleConfig> {
  let row: Record<string, unknown> = {};
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("store_settings").select("*").eq("id", true).maybeSingle();
    row = (data as unknown as Record<string, unknown> | null) ?? {};
  } catch {
    row = {};
  }
  // Static references only — dynamic process.env[key] doesn't resolve in the
  // Cloudflare Workers runtime (same constraint as getIntegrationConfig above).
  const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  const envFolder = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
  const pick = (col: string, envVal: string): string => {
    const v = row[col];
    if (typeof v === "string" && v.trim()) return v.trim();
    return envVal;
  };
  return {
    serviceAccountJson: pick("google_service_account_json", envJson),
    driveFolderId: pick("google_drive_folder_id", envFolder),
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
