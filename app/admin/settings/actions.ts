"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

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
  };
  await sb.from("store_settings").upsert(store as never);

  const shipMode = String(formData.get("shipping_mode") || "live");
  await sb.from("shipping_settings").upsert({ id: true, mode: shipMode } as never);
  revalidatePath("/admin/settings");
}
