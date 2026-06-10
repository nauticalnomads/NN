// Social posting domain logic. The actual publish goes through a Make.com
// webhook (configured in admin → Settings as `make_webhook_url`), which fans the
// post out to Instagram/Facebook. Shared by the manual "Post" button
// (app/admin/social/actions.ts) and the scheduler cron (app/api/cron/social),
// so both paths dispatch identically and flip the draft's status the same way.
import { createServiceClient } from "@/lib/supabase/service";

type DraftRow = {
  image_url: string | null;
  caption: string | null;
  platform_targets: string[];
  status: string;
};

// Publish one draft via the Make.com webhook and record the outcome. Idempotent
// guard: only acts on a draft that's still `draft` or `scheduled` (so a cron
// run racing the manual button, or a double cron fire, can't double-post).
// Returns true if the webhook accepted the post.
export async function dispatchSocialPost(draftId: string): Promise<boolean> {
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
    .select("image_url, caption, platform_targets, status")
    .eq("id", draftId)
    .maybeSingle();
  const d = draftData as unknown as DraftRow | null;
  if (!d || (d.status !== "draft" && d.status !== "scheduled")) return false;

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

  // CAS on status: only flip if still draft/scheduled, so concurrent dispatchers
  // can't both mark it (and a failed publish drops back so it can be retried).
  await sb
    .from("social_drafts")
    .update({
      status: posted ? "posted" : "failed",
      posted_at: posted ? new Date().toISOString() : null,
    } as never)
    .eq("id", draftId)
    .in("status", ["draft", "scheduled"]);

  return posted;
}
