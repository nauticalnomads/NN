"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

// Save POD provider credentials to store_settings. Write-only: only fields with
// a new (non-empty) value are updated, so blanks keep the current secret. Needs
// the provider columns (see the SQL shown in /admin/settings).
export async function saveIntegrations(formData: FormData) {
  await requireOps();
  const sb = createServiceClient();
  // Write-only secret fields: only update when a new value is provided.
  const secretFields = [
    "printful_api_key",
    "printful_store_id",
    "printful_webhook_secret",
    "printify_api_key",
    "printify_shop_id",
    "printify_webhook_secret",
    "google_service_account_json",
  ];
  // Plain fields: always save (empty string clears the value).
  const plainFields = ["google_drive_folder_id", "email_covers_folder_id", "make_webhook_url"];

  const patch: Record<string, string | null> = {};
  for (const f of secretFields) {
    const v = String(formData.get(f) || "").trim();
    if (v) patch[f] = v;
  }
  for (const f of plainFields) {
    const v = String(formData.get(f) || "").trim();
    patch[f] = v || null;
  }
  if (Object.keys(patch).length === 0) {
    redirect("/admin/settings?integrations=saved");
  }
  const { error } = await sb
    .from("store_settings")
    .update(patch as never)
    .eq("id", true);
  revalidatePath("/admin/settings");
  // A missing-column error means the one-time migration hasn't been run yet.
  redirect(`/admin/settings?integrations=${error ? "migrate" : "saved"}`);
}

type Zone = { name: string; countries: string[]; rate: number };

function parseZones(raw: string | null): Zone[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    return v
      .map((z: unknown) => {
        const x = z as { name?: unknown; countries?: unknown; rate?: unknown };
        return {
          name: String(x.name ?? "").trim(),
          countries: Array.isArray(x.countries)
            ? (x.countries as unknown[]).map((c) => String(c).trim().toUpperCase()).filter(Boolean)
            : [],
          rate: Number(x.rate) || 0,
        };
      })
      .filter((z) => z.name && z.countries.length);
  } catch {
    return null;
  }
}

export async function updateSettings(formData: FormData) {
  const actor = await requireOps();
  const sb = createServiceClient();

  // Snapshot the sensitive fields before the write so we can audit-log changes.
  const { data: prevStore } = await sb
    .from("store_settings")
    .select("auto_fulfilment_enabled, fulfilment_dry_run, vat_enabled")
    .eq("id", true)
    .maybeSingle();
  const { data: prevShip } = await sb
    .from("shipping_settings")
    .select("mode")
    .eq("id", true)
    .maybeSingle();
  const before = {
    ...((prevStore as unknown as Record<string, unknown>) || {}),
    shipping_mode: (prevShip as unknown as { mode?: string } | null)?.mode,
  };

  const store = {
    id: true,
    auto_fulfilment_enabled: formData.get("auto_fulfilment_enabled") === "on",
    fulfilment_dry_run: formData.get("fulfilment_dry_run") === "on",
    vat_enabled: formData.get("vat_enabled") === "on",
    vat_rate: Number(formData.get("vat_rate") || 0),
    brand_voice: String(formData.get("brand_voice") || ""),
    notification_prefs: {
      fulfilment_failed: formData.get("notify_fulfilment_failed") === "on",
      refund_requested: formData.get("notify_refund_requested") === "on",
      dispute_opened: formData.get("notify_dispute_opened") === "on",
    },
  };
  await sb.from("store_settings").upsert(store as never);

  const ship: { id: boolean; mode: string; flat_zones?: Zone[] } = {
    id: true,
    mode: String(formData.get("shipping_mode") || "live"),
  };
  const zones = parseZones(String(formData.get("flat_zones") || ""));
  if (zones) ship.flat_zones = zones;
  await sb.from("shipping_settings").upsert(ship as never);

  // Audit-log changes to sensitive toggles (§B-07 #9). Best-effort: if the
  // audit_log table isn't migrated yet, saving still succeeds.
  const after: Record<string, unknown> = {
    auto_fulfilment_enabled: store.auto_fulfilment_enabled,
    fulfilment_dry_run: store.fulfilment_dry_run,
    vat_enabled: store.vat_enabled,
    shipping_mode: ship.mode,
  };
  const entries = Object.entries(after)
    .filter(([k, v]) => before[k as keyof typeof before] !== v)
    .map(([k, v]) => ({
      actor_id: actor.id,
      actor_email: actor.email,
      action: `settings.${k}`,
      detail: { from: before[k as keyof typeof before] ?? null, to: v },
    }));
  if (entries.length) {
    await sb
      .from("audit_log")
      .insert(entries as never)
      .then(
        () => undefined,
        () => undefined,
      );
  }

  revalidatePath("/admin/settings");
}
