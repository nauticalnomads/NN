"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

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
  await requireOps();
  const sb = createServiceClient();

  const store = {
    id: true,
    auto_fulfilment_enabled: formData.get("auto_fulfilment_enabled") === "on",
    fulfilment_dry_run: formData.get("fulfilment_dry_run") === "on",
    vat_enabled: formData.get("vat_enabled") === "on",
    vat_rate: Number(formData.get("vat_rate") || 0),
    brand_voice: String(formData.get("brand_voice") || ""),
    make_webhook_url: String(formData.get("make_webhook_url") || "").trim() || null,
  };
  await sb.from("store_settings").upsert(store as never);

  const ship: { id: boolean; mode: string; flat_zones?: Zone[] } = {
    id: true,
    mode: String(formData.get("shipping_mode") || "live"),
  };
  const zones = parseZones(String(formData.get("flat_zones") || ""));
  if (zones) ship.flat_zones = zones;
  await sb.from("shipping_settings").upsert(ship as never);

  revalidatePath("/admin/settings");
}
