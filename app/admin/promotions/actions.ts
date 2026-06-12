"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { normalisePromo } from "@/lib/promo";
import { writeAudit } from "@/lib/audit";

// Create a percent-off code. Ops only (discounts move money). Codes are stored
// normalised (uppercase, no spaces) so checkout lookup is exact-match.
export async function createPromoCode(formData: FormData): Promise<void> {
  const admin = await requireOps();
  const code = normalisePromo(String(formData.get("code") || ""));
  const percent = Number(formData.get("percent"));
  const startsRaw = String(formData.get("starts_at") || "").trim();
  const endsRaw = String(formData.get("ends_at") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;

  if (!code || code.length < 3) redirect("/admin/promotions?notice=bad_code");
  if (!(Number.isFinite(percent) && percent > 0 && percent <= 100)) {
    redirect("/admin/promotions?notice=bad_percent");
  }
  const starts_at = startsRaw ? new Date(startsRaw).toISOString() : null;
  const ends_at = endsRaw ? new Date(endsRaw).toISOString() : null;

  const sb = createServiceClient();
  const { error } = await sb
    .from("promo_codes")
    .insert({ code, percent, starts_at, ends_at, note } as never);
  if (error) {
    const notice = error.message.includes("duplicate") ? "duplicate" : "migrate";
    redirect(`/admin/promotions?notice=${notice}`);
  }

  await writeAudit(admin, "promo.created", { code, percent, starts_at, ends_at });
  revalidatePath("/admin/promotions");
  redirect("/admin/promotions?notice=created");
}

// Toggle a code on/off (safer than deleting — history stays intact).
export async function setPromoActive(formData: FormData): Promise<void> {
  const admin = await requireOps();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!id) return;
  const sb = createServiceClient();
  const { data } = await sb
    .from("promo_codes")
    .update({ active, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select("code")
    .maybeSingle();
  const code = (data as unknown as { code?: string } | null)?.code;
  await writeAudit(admin, "promo.active", { id, code, to: active });
  revalidatePath("/admin/promotions");
}

export async function deletePromoCode(formData: FormData): Promise<void> {
  const admin = await requireOps();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  const { data } = await sb.from("promo_codes").delete().eq("id", id).select("code").maybeSingle();
  const code = (data as unknown as { code?: string } | null)?.code;
  await writeAudit(admin, "promo.deleted", { id, code });
  revalidatePath("/admin/promotions");
}
