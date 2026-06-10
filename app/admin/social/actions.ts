"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { captionImage } from "@/lib/anthropic";
import { dispatchSocialPost } from "@/lib/social";

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

// Publish a draft (or a scheduled post) right now via the Make.com webhook.
export async function postDraft(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await dispatchSocialPost(id);
  revalidatePath("/admin/social");
}

// Queue a draft to auto-publish at a future time. The hourly cron
// (/api/cron/social) picks up `scheduled` rows whose time has passed. A past or
// missing time is treated as "post within the hour" (status flips to scheduled,
// the next cron run sends it).
export async function scheduleDraft(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  const when = String(formData.get("scheduled_at") || "");
  if (!id || !when) return;
  const at = new Date(when);
  if (Number.isNaN(at.getTime())) return;
  const sb = createServiceClient();
  await sb
    .from("social_drafts")
    .update({ status: "scheduled", scheduled_at: at.toISOString() } as never)
    .eq("id", id)
    .eq("status", "draft");
  revalidatePath("/admin/social");
}

// Pull a scheduled post back to a plain draft (cancels the auto-publish).
export async function unscheduleDraft(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const sb = createServiceClient();
  await sb
    .from("social_drafts")
    .update({ status: "draft", scheduled_at: null } as never)
    .eq("id", id)
    .eq("status", "scheduled");
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
