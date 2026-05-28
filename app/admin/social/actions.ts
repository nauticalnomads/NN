"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { captionImage } from "@/lib/anthropic";

export async function createDraft(formData: FormData) {
  const admin = await requireStaff();
  const imageUrl = String(formData.get("image_url") || "");
  const driveId = String(formData.get("drive_id") || "");
  if (!imageUrl) return;

  const sb = createServiceClient();
  const { data: settingsData } = await sb
    .from("store_settings")
    .select("brand_voice")
    .eq("id", true)
    .maybeSingle();
  const voice = (settingsData as unknown as { brand_voice: string } | null)?.brand_voice || "";

  const caption = (await captionImage(imageUrl, voice)) ?? "";
  await sb.from("social_drafts").insert({
    image_url: imageUrl,
    image_ref: driveId,
    caption,
    status: "draft",
    platform_targets: ["instagram", "facebook"],
    created_by: admin.id,
  } as never);
  revalidatePath("/admin/social");
}

export async function postDraft(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  const { data: settingsData } = await sb
    .from("store_settings")
    .select("make_webhook_url")
    .eq("id", true)
    .maybeSingle();
  const webhook = (settingsData as unknown as { make_webhook_url: string | null } | null)
    ?.make_webhook_url;
  const { data: draftData } = await sb
    .from("social_drafts")
    .select("image_url, caption, platform_targets")
    .eq("id", id)
    .maybeSingle();
  const d = draftData as unknown as {
    image_url: string | null;
    caption: string | null;
    platform_targets: string[];
  } | null;
  if (!d) return;

  let posted = false;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: d.image_url,
          caption: d.caption,
          platforms: d.platform_targets,
        }),
      });
      posted = r.ok;
    } catch {
      posted = false;
    }
  }
  await sb
    .from("social_drafts")
    .update({
      status: posted ? "posted" : "failed",
      posted_at: posted ? new Date().toISOString() : null,
    } as never)
    .eq("id", id);
  revalidatePath("/admin/social");
}

export async function deleteDraft(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  await sb.from("social_drafts").delete().eq("id", id);
  revalidatePath("/admin/social");
}
