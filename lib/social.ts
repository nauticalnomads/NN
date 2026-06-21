// Social posting domain logic. The actual publish goes through a Make.com
// webhook (configured in admin → Settings as `make_webhook_url`), which fans the
// post out to Instagram/Facebook. Shared by the manual "Post" button
// (app/admin/social/actions.ts) and the scheduler cron (app/api/cron/social),
// so both paths dispatch identically and flip the draft's status the same way.
import { createServiceClient } from "@/lib/supabase/service";
import { listImages, driveImageUrl, driveCaptionUrl, socialImageUrl } from "@/lib/google-drive";
import { captionImage } from "@/lib/anthropic";

// Autopilot: keep a rolling queue of QUEUE_TARGET scheduled posts, going out at
// SLOT_HOURS_UTC each day (10:00 & 17:00 GMT). When one publishes the queue drops
// and the next top-up refills it, so the schedule stays full hands-free.
export const QUEUE_TARGET = 20;
export const SLOT_HOURS_UTC = [10, 17];
const DEFAULT_PLATFORMS = ["instagram", "facebook"];
// Cap captions generated per top-up run so a single cron tick / toggle stays
// within runtime limits; the hourly cron converges the queue over a few runs.
const TOPUP_BATCH = 8;

// Run `fn` over `items` with at most `limit` in flight, preserving result order.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// The next `count` posting slots (10:00 / 17:00 UTC) strictly after `after`.
export function nextSlots(count: number, after: Date): Date[] {
  const slots: Date[] = [];
  const cursor = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), 0, 0, 0, 0),
  );
  while (slots.length < count) {
    for (const h of SLOT_HOURS_UTC) {
      const slot = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), h, 0, 0, 0),
      );
      if (slot.getTime() > after.getTime() && slots.length < count) slots.push(slot);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
}

export async function getAutopilot(): Promise<boolean> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("store_settings")
      .select("social_autopilot")
      .eq("id", true)
      .maybeSingle();
    return !!(data as unknown as { social_autopilot?: boolean } | null)?.social_autopilot;
  } catch {
    return false;
  }
}

export async function setAutopilot(on: boolean): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("store_settings")
    .update({ social_autopilot: on } as never)
    .eq("id", true);
}

// Saved drag-order of Drive file ids (Instagram-style grid). Drives the sequence
// posts are scheduled in. Unknown/new images fall back to name order.
export async function getImageOrder(): Promise<string[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("store_settings")
      .select("social_image_order")
      .eq("id", true)
      .maybeSingle();
    const v = (data as unknown as { social_image_order?: string[] } | null)?.social_image_order;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function setImageOrder(order: string[]): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("store_settings")
    .update({ social_image_order: order } as never)
    .eq("id", true);
}

async function brandVoice(): Promise<string> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("store_settings")
    .select("brand_voice")
    .eq("id", true)
    .maybeSingle();
  return (data as unknown as { brand_voice: string } | null)?.brand_voice || "";
}

// Generate a caption for one Drive image (resized thumbnail to stay under the
// vision model's size limit). Returns "" if captioning is unavailable.
async function captionFor(fileId: string, voice: string): Promise<string> {
  const captionUrl = (await driveCaptionUrl(fileId)) ?? driveImageUrl(fileId);
  return (await captionImage(captionUrl, voice)) ?? "";
}

// Drive images sorted by the saved drag-order; anything not in the order is
// appended in name order so new uploads still appear (at the end).
export function applyImageOrder<T extends { id: string; name: string }>(
  images: T[],
  order: string[],
): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...images].sort((a, b) => {
    const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
    return ra - rb || a.name.localeCompare(b.name);
  });
}

type QueueRow = { image_ref: string | null; scheduled_at: string | null; status: string };

// Refill the scheduled queue to QUEUE_TARGET when autopilot is on, then caption
// + schedule each pick at the next free slot after the current tail. Bounded to
// TOPUP_BATCH per call; safe to run on every cron tick. Returns how many drafts
// it generated.
//
// Selection priority (this is what makes new Drive uploads go out first):
//   1. Photos never used before — newest-added first (Drive createdTime desc).
//   2. Only once those run out, reuse already-posted photos, least-used first.
// "Used" is judged against the WHOLE history (posted + queued), not just what's
// currently waiting, so a photo doesn't look fresh again the moment it publishes.
export async function topUpSocialDrafts(): Promise<number> {
  if (!(await getAutopilot())) return 0;

  const sb = createServiceClient();
  const images = await listImages(); // newest-first from Drive
  if (images.length === 0) return 0;

  // Full history across every status: how many times each photo has been used,
  // which photos are still waiting in the queue (never double-schedule those),
  // and the tail of the schedule to append after.
  const { data: allData } = await sb
    .from("social_drafts")
    .select("image_ref, scheduled_at, status");
  const rows = (allData as unknown as QueueRow[]) ?? [];

  const usage = new Map<string, number>();
  const pending = new Set<string>();
  let tailMs = Date.now();
  let scheduledCount = 0;
  for (const r of rows) {
    if (r.image_ref) usage.set(r.image_ref, (usage.get(r.image_ref) ?? 0) + 1);
    if (r.status === "scheduled") scheduledCount += 1;
    if (r.status === "draft" || r.status === "scheduled") {
      if (r.image_ref) pending.add(r.image_ref);
      if (r.scheduled_at) tailMs = Math.max(tailMs, new Date(r.scheduled_at).getTime());
    }
  }

  const need = Math.min(QUEUE_TARGET - scheduledCount, TOPUP_BATCH);
  if (need <= 0) return 0;

  // Skip photos already waiting in the queue, then: newest unused first, then
  // least-used for reuse. `images` arrives newest-first, so it's a stable
  // tiebreak for both groups.
  const candidates = images.filter((img) => !pending.has(img.id));
  const unused = candidates.filter((img) => !usage.has(img.id));
  const reuse = candidates
    .filter((img) => usage.has(img.id))
    .sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0));
  const picks = [...unused, ...reuse].slice(0, need);
  if (picks.length === 0) return 0;

  // Schedule after the current tail (latest scheduled post), else from now.
  const slots = nextSlots(picks.length, new Date(tailMs));
  const voice = await brandVoice();

  let made = 0;
  for (let i = 0; i < picks.length; i++) {
    const img = picks[i];
    const caption = await captionFor(img.id, voice);
    const { error } = await sb.from("social_drafts").insert({
      image_ref: img.id,
      image_url: driveImageUrl(img.id),
      caption,
      status: "scheduled",
      scheduled_at: slots[i].toISOString(),
      platform_targets: DEFAULT_PLATFORMS,
    } as never);
    if (!error) made += 1;
  }
  return made;
}

// Rebuild the scheduled queue from scratch in the saved drag-order. Clears
// not-yet-published rows (draft + scheduled), then schedules the first
// QUEUE_TARGET images (in order) at the next 10:00/17:00 GMT slots.
//
// Deliberately does NOT caption here: captioning 20 images inline means ~40
// Drive+AI subrequests in one Worker invocation, which trips Cloudflare's
// resource limits (error 1102). Rows are inserted caption-less in a single
// batched insert (fast, a couple of subrequests); the hourly cron
// (captionPendingScheduled) fills captions in the background, and the per-post
// "Regenerate" button captions one on demand. Pass `orderOverride` to use the
// order the admin just submitted.
export async function rebuildQueueFromOrder(orderOverride?: string[]): Promise<number> {
  const sb = createServiceClient();
  const images = await listImages();
  if (images.length === 0) return 0;

  const order = orderOverride && orderOverride.length ? orderOverride : await getImageOrder();
  const ordered = applyImageOrder(images, order);

  // Prefer photos that have never been used over already-posted/queued ones, so a
  // rebuild fills the queue with NEW images first and doesn't re-post recent ones
  // while unused photos exist. Within each group the drag order is preserved.
  const { data: used } = await sb.from("social_drafts").select("image_ref");
  const usedRefs = new Set(
    ((used as unknown as { image_ref: string | null }[]) ?? [])
      .map((r) => r.image_ref)
      .filter(Boolean) as string[],
  );
  const fresh = ordered.filter((img) => !usedRefs.has(img.id));
  const reuse = ordered.filter((img) => usedRefs.has(img.id));
  const picks = [...fresh, ...reuse].slice(0, QUEUE_TARGET);

  // Wipe the pending queue (keep posted/failed history).
  await sb.from("social_drafts").delete().in("status", ["draft", "scheduled"]);

  const slots = nextSlots(picks.length, new Date());
  const rows = picks.map((img, i) => ({
    image_ref: img.id,
    image_url: driveImageUrl(img.id),
    caption: "",
    status: "scheduled",
    scheduled_at: slots[i].toISOString(),
    platform_targets: DEFAULT_PLATFORMS,
  }));
  const { error } = await sb.from("social_drafts").insert(rows as never);
  return error ? 0 : rows.length;
}

// Fill captions for scheduled posts that don't have one yet (e.g. just created by
// a queue rebuild). Bounded per call so a cron tick stays well within limits.
export async function captionPendingScheduled(limit = 10): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("social_drafts")
    .select("id, image_ref, caption")
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true })
    .limit(60);
  const rows =
    (data as unknown as { id: string; image_ref: string | null; caption: string | null }[]) ?? [];
  const pending = rows.filter((r) => r.image_ref && !r.caption?.trim()).slice(0, limit);
  if (pending.length === 0) return 0;

  const voice = await brandVoice();
  const captions = await mapLimit(pending, 5, (r) => captionFor(r.image_ref as string, voice));
  let made = 0;
  for (let i = 0; i < pending.length; i++) {
    if (!captions[i]) continue;
    const { error } = await sb
      .from("social_drafts")
      .update({ caption: captions[i] } as never)
      .eq("id", pending[i].id)
      .eq("status", "scheduled");
    if (!error) made += 1;
  }
  return made;
}

// Regenerate the caption for a single draft/scheduled post from its image.
export async function regenerateDraftCaption(draftId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("social_drafts")
    .select("image_ref")
    .eq("id", draftId)
    .maybeSingle();
  const fileId = (data as unknown as { image_ref: string | null } | null)?.image_ref;
  if (!fileId) return false;
  const caption = await captionFor(fileId, await brandVoice());
  const { error } = await sb
    .from("social_drafts")
    .update({ caption } as never)
    .eq("id", draftId);
  return !error;
}

type DraftRow = {
  image_ref: string | null;
  image_url: string | null;
  caption: string | null;
  platform_targets: string[];
  status: string;
};

// Statuses a post can be dispatched from: not-yet-sent (draft/scheduled) plus
// `failed` so the "Retry" button can re-send. A successful `posted` row is never
// re-dispatched.
const DISPATCHABLE = ["draft", "scheduled", "failed"];

// Publish one draft via the Make.com webhook and record the outcome. Idempotent
// guard: only acts on a draft that's still dispatchable (so a cron run racing
// the manual button, or a double cron fire, can't double-post). Returns true if
// the webhook accepted the post.
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
    .select("image_ref, image_url, caption, platform_targets, status")
    .eq("id", draftId)
    .maybeSingle();
  const d = draftData as unknown as DraftRow | null;
  if (!d || !DISPATCHABLE.includes(d.status)) return false;

  // Hand Meta an image served from OUR domain (app/api/social-image/[id]), which
  // proxies a clean JPEG. Google's own links are unreliable for Meta's
  // server-side fetcher (sharing/redirect/CDN quirks) and caused "Invalid
  // parameter (100)" and "Media ID is not available (9007)". Fall back to the
  // stored URL only if we have no Drive file id.
  const imageUrl = d.image_ref ? socialImageUrl(d.image_ref) : d.image_url;

  let posted = false;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: d.caption,
          platforms: d.platform_targets,
        }),
        // Don't let a hung Make/Meta request stall the cron tick.
        signal: AbortSignal.timeout(20_000),
      });
      posted = r.ok;
      if (!r.ok) {
        // Surface why Make/Meta rejected it (e.g. the Instagram OAuth/image
        // errors) instead of failing silently.
        const body = await r.text().catch(() => "");
        console.error(`Make webhook rejected (${r.status}):`, body.slice(0, 500));
      }
    } catch (e) {
      console.error("Make webhook request failed:", e instanceof Error ? e.message : e);
      posted = false;
    }
  }

  // CAS on status: only flip if still dispatchable, so concurrent dispatchers
  // can't both mark it (and a failed publish stays `failed` so it can be retried).
  await sb
    .from("social_drafts")
    .update({
      status: posted ? "posted" : "failed",
      posted_at: posted ? new Date().toISOString() : null,
    } as never)
    .eq("id", draftId)
    .in("status", DISPATCHABLE);

  return posted;
}
