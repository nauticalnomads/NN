"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  dispatchSocialPost,
  setAutopilot,
  topUpSocialDrafts,
  setImageOrder,
  rebuildQueueFromOrder,
  regenerateDraftCaption,
} from "@/lib/social";

// Save the dragged grid order, then rebuild the whole scheduled queue in that
// order. Captioning every post is slow, so the heavy rebuild runs in after()
// (the action returns immediately; captions populate over the next minute).
export async function saveSocialOrder(formData: FormData) {
  await requireStaff();
  let order: string[] = [];
  try {
    order = JSON.parse(String(formData.get("order") || "[]"));
  } catch {
    order = [];
  }
  if (!Array.isArray(order)) order = [];
  await setImageOrder(order.map(String));
  after(() => rebuildQueueFromOrder());
  revalidatePath("/admin/social");
}

// Regenerate one post's caption from its image.
export async function regenerateCaption(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await regenerateDraftCaption(id);
  revalidatePath("/admin/social");
}

// Flip autopilot on/off. Turning it on kicks an immediate top-up so the queue
// starts filling right away; the hourly cron keeps it topped to QUEUE_TARGET.
export async function toggleAutopilot(formData: FormData) {
  await requireStaff();
  const on = String(formData.get("on") || "") === "1";
  await setAutopilot(on);
  if (on) after(() => topUpSocialDrafts());
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
