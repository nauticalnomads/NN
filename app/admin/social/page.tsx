import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { listImages, driveImageUrl, driveThumbnailUrl } from "@/lib/google-drive";
import { getAutopilot, QUEUE_TARGET, SLOT_HOURS_UTC } from "@/lib/social";
import {
  createDraft,
  postDraft,
  deleteDraft,
  scheduleDraft,
  unscheduleDraft,
  toggleAutopilot,
} from "./actions";

type Draft = {
  id: string;
  image_ref: string | null;
  image_url: string | null;
  caption: string | null;
  status: string;
  platform_targets: string[];
  scheduled_at: string | null;
  created_at: string;
};

export default async function AdminSocial() {
  await requireStaff();
  const images = await listImages();
  const autopilot = await getAutopilot();
  const sb = createServiceClient();
  const { data } = await sb
    .from("social_drafts")
    .select("id, image_ref, image_url, caption, status, platform_targets, scheduled_at, created_at")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(60);
  const drafts = (data as unknown as Draft[]) || [];
  const scheduled = drafts.filter((d) => d.status === "scheduled");
  const plainDrafts = drafts.filter((d) => d.status === "draft");
  const done = drafts.filter((d) => d.status === "posted" || d.status === "failed");
  const scheduledCount = scheduled.length;
  const slotLabel = SLOT_HOURS_UTC.map((h) => `${String(h).padStart(2, "0")}:00`).join(" & ");

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Social</h1>
      <p className="mt-3 max-w-xl font-body text-body text-ink/60">
        Pick a photo from Drive. AI writes a brand-voice caption. Review, schedule, then publish via
        Make.com.
      </p>

      {/* ── Autopilot ──────────────────────────────────────────────────────── */}
      <section className="mt-8 rounded-sm border border-ink/10 bg-surface-2/40 p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="font-display text-heading text-ink">Autopilot</h2>
            <p className="mt-1 max-w-lg font-body text-body text-ink/60">
              Keeps {QUEUE_TARGET} captioned posts queued at all times, auto-publishing at{" "}
              <strong>{slotLabel} GMT</strong> daily. When one posts, the next is generated and
              scheduled automatically — no manual work.
            </p>
            <p className="mt-2 font-mono text-caption text-ink/50">
              {autopilot ? (
                <>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] tracking-widest text-green-800 uppercase">
                    ● On
                  </span>{" "}
                  {scheduledCount} of {QUEUE_TARGET} scheduled
                  {scheduledCount < QUEUE_TARGET ? " (queue filling — refills hourly)" : ""}
                </>
              ) : (
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] tracking-widest text-ink/60 uppercase">
                  ○ Off
                </span>
              )}
            </p>
          </div>
          <form action={toggleAutopilot} className="shrink-0">
            <input type="hidden" name="on" value={autopilot ? "0" : "1"} />
            <button
              className={`rounded-sm px-5 py-2 font-mono text-caption tracking-widest uppercase ${
                autopilot
                  ? "border border-ink/30 text-ink hover:border-ink/60"
                  : "bg-accent-sun text-surface"
              }`}
            >
              {autopilot ? "Turn off" : "Turn on"}
            </button>
          </form>
        </div>
      </section>

      {/* ── Scheduled (the queue) ──────────────────────────────────────────── */}
      <h2 className="mt-12 font-mono text-caption tracking-wide text-ink/60 uppercase">
        Scheduled ({scheduled.length})
      </h2>
      <p className="mt-1 font-mono text-caption text-ink/40">
        Auto-publish at their time, or hit “Post now” to send any one immediately.
      </p>
      <ul className="mt-4 space-y-3">
        {scheduled.map((d) => (
          <li key={d.id} className="flex gap-5 rounded-sm border border-ink/10 p-4">
            <DraftImage draft={d} />
            <div className="flex-1">
              <p className="whitespace-pre-line font-body text-body text-ink">
                {d.caption ?? "(no caption)"}
              </p>
              <p className="mt-2 font-mono text-caption text-accent-sun">
                {d.scheduled_at
                  ? `Scheduled for ${new Date(d.scheduled_at).toLocaleString("en-GB")}`
                  : "Scheduled"}
              </p>
            </div>
            <div className="flex w-44 shrink-0 flex-col gap-2">
              <form action={postDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="w-full rounded-sm bg-accent-sun px-3 py-1.5 font-mono text-caption tracking-widest text-surface uppercase">
                  Post now
                </button>
              </form>
              <form action={unscheduleDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="w-full rounded-sm border border-ink/30 px-3 py-1 font-mono text-caption tracking-widest text-ink uppercase transition-colors hover:border-ink/60">
                  Unschedule
                </button>
              </form>
              <form action={deleteDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="font-mono text-caption tracking-widest text-ink/50 uppercase underline-offset-4 hover:underline">
                  Discard
                </button>
              </form>
            </div>
          </li>
        ))}
        {scheduled.length === 0 && (
          <p className="font-body text-body text-ink/50">
            Nothing scheduled yet. Turn on Autopilot above, or schedule a draft below.
          </p>
        )}
      </ul>

      {/* ── Drafts (not yet scheduled) ─────────────────────────────────────── */}
      <h2 className="mt-12 font-mono text-caption tracking-wide text-ink/60 uppercase">
        Drafts ({plainDrafts.length})
      </h2>
      <ul className="mt-4 space-y-3">
        {plainDrafts.map((d) => (
          <li key={d.id} className="flex gap-5 rounded-sm border border-ink/10 p-4">
            <DraftImage draft={d} />
            <div className="flex-1">
              <p className="whitespace-pre-line font-body text-body text-ink">
                {d.caption ?? "(no caption)"}
              </p>
              <p className="mt-2 font-mono text-caption text-ink/50">
                Draft · {new Date(d.created_at).toLocaleString("en-GB")}
              </p>
            </div>
            <div className="flex w-44 shrink-0 flex-col gap-2">
              <form action={postDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="w-full rounded-sm bg-accent-sun px-3 py-1.5 font-mono text-caption tracking-widest text-surface uppercase">
                  Post now
                </button>
              </form>
              {/* Schedule: pick a future time; the hourly cron publishes it. */}
              <form action={scheduleDraft} className="flex flex-col gap-1.5">
                <input type="hidden" name="id" value={d.id} />
                <input
                  type="datetime-local"
                  name="scheduled_at"
                  required
                  className="rounded-sm border border-ink/20 bg-surface px-2 py-1 font-mono text-caption text-ink"
                />
                <button className="rounded-sm border border-ink/30 px-3 py-1 font-mono text-caption tracking-widest text-ink uppercase transition-colors hover:border-ink/60">
                  Schedule
                </button>
              </form>
              <form action={deleteDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="font-mono text-caption tracking-widest text-ink/50 uppercase underline-offset-4 hover:underline">
                  Discard
                </button>
              </form>
            </div>
          </li>
        ))}
        {plainDrafts.length === 0 && (
          <p className="font-body text-body text-ink/50">
            No drafts. Generate one from a photo below.
          </p>
        )}
      </ul>

      {/* ── Drive photos (generate new drafts) ─────────────────────────────── */}
      <h2 className="mt-12 font-mono text-caption tracking-wide text-ink/60 uppercase">
        Photos in Drive ({images.length})
      </h2>
      {images.length === 0 ? (
        <p className="mt-3 font-body text-body text-ink/50">
          No photos. Check GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_FOLDER_ID env vars.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="rounded-sm border border-ink/10 p-3">
              <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-ink/5">
                {/* Drive thumbnail endpoint — renders directly in <img>, unoptimized
                    so we don't have to whitelist + run it through the optimizer. */}
                <Image
                  src={img.thumbnailLink || driveThumbnailUrl(img.id)}
                  alt={img.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <p className="mt-2 truncate font-mono text-caption text-ink/70">{img.name}</p>
              <form action={createDraft} className="mt-2">
                <input type="hidden" name="drive_id" value={img.id} />
                <input type="hidden" name="image_url" value={driveImageUrl(img.id)} />
                <button className="w-full rounded-sm bg-ink py-1 font-mono text-caption tracking-widest text-surface uppercase">
                  Generate caption
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* ── Recently posted / failed ───────────────────────────────────────── */}
      {done.length > 0 && (
        <>
          <h2 className="mt-12 font-mono text-caption tracking-wide text-ink/60 uppercase">
            Recent ({done.length})
          </h2>
          <ul className="mt-4 space-y-3">
            {done.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-5 rounded-sm border border-ink/10 p-3 opacity-75"
              >
                <DraftImage draft={d} small />
                <div className="flex-1">
                  <p className="line-clamp-2 font-body text-caption text-ink/70">
                    {d.caption ?? "(no caption)"}
                  </p>
                  <p className="mt-1 font-mono text-caption">
                    <span className={d.status === "posted" ? "text-green-700" : "text-red-600"}>
                      {d.status === "posted" ? "Posted" : "Failed"}
                    </span>{" "}
                    <span className="text-ink/40">
                      · {new Date(d.created_at).toLocaleString("en-GB")}
                    </span>
                  </p>
                </div>
                {d.status === "failed" && (
                  <form action={postDraft}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="rounded-sm border border-ink/30 px-3 py-1 font-mono text-caption tracking-widest text-ink uppercase transition-colors hover:border-ink/60">
                      Retry
                    </button>
                  </form>
                )}
                <form action={deleteDraft}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="font-mono text-caption tracking-widest text-ink/40 uppercase underline-offset-4 hover:underline">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Preview thumbnail. Prefer the Drive thumbnail endpoint (renders directly in an
// <img>); the stored image_url is a uc?export=view download link that browsers
// won't render inline. Falls back to image_url if there's no Drive file id.
function DraftImage({ draft, small = false }: { draft: Draft; small?: boolean }) {
  const src = draft.image_ref
    ? driveThumbnailUrl(draft.image_ref, small ? 120 : 220)
    : draft.image_url;
  if (!src) return null;
  const size = small ? 56 : 96;
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={`${small ? "h-14 w-14" : "h-24 w-24"} shrink-0 rounded-sm bg-ink/5 object-cover`}
    />
  );
}
