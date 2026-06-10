import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { listImages, driveImageUrl } from "@/lib/google-drive";
import { createDraft, postDraft, deleteDraft, scheduleDraft, unscheduleDraft } from "./actions";

export default async function AdminSocial() {
  await requireStaff();
  const images = await listImages();
  const sb = createServiceClient();
  const { data } = await sb
    .from("social_drafts")
    .select("id, image_url, caption, status, platform_targets, scheduled_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  const drafts =
    (data as unknown as Array<{
      id: string;
      image_url: string | null;
      caption: string | null;
      status: string;
      platform_targets: string[];
      scheduled_at: string | null;
      created_at: string;
    }>) || [];

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Social</h1>
      <p className="mt-3 max-w-xl font-body text-body text-ink/60">
        Pick a photo from Drive. AI writes a brand-voice caption. Review, schedule, then publish via
        Make.com.
      </p>

      <h2 className="mt-10 font-mono text-caption tracking-wide text-ink/60 uppercase">
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
              {img.thumbnailLink && (
                <div className="relative aspect-square w-full overflow-hidden rounded-sm">
                  {/* Drive thumbnails (lh3.googleusercontent.com) — unoptimized
                      so we don't have to whitelist + run them through the optimizer. */}
                  <Image
                    src={img.thumbnailLink}
                    alt={img.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
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

      <h2 className="mt-12 font-mono text-caption tracking-wide text-ink/60 uppercase">Drafts</h2>
      <ul className="mt-4 space-y-3">
        {drafts.map((d) => (
          <li key={d.id} className="flex gap-5 rounded-sm border border-ink/10 p-4">
            {d.image_url && (
              <Image
                src={d.image_url}
                alt=""
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 shrink-0 rounded-sm object-cover"
              />
            )}
            <div className="flex-1">
              <p className="whitespace-pre-line font-body text-body text-ink">
                {d.caption ?? "(no caption)"}
              </p>
              <p className="mt-2 font-mono text-caption text-ink/50">
                {d.status}
                {d.status === "scheduled" && d.scheduled_at
                  ? ` for ${new Date(d.scheduled_at).toLocaleString()}`
                  : ` · ${new Date(d.created_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex w-56 shrink-0 flex-col gap-2">
              {d.status === "draft" && (
                <>
                  <form action={postDraft}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="w-full rounded-sm bg-accent-sun px-3 py-1 font-mono text-caption tracking-widest text-surface uppercase">
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
                </>
              )}
              {d.status === "scheduled" && (
                <>
                  <form action={postDraft}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="w-full rounded-sm bg-accent-sun px-3 py-1 font-mono text-caption tracking-widest text-surface uppercase">
                      Post now
                    </button>
                  </form>
                  <form action={unscheduleDraft}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="w-full rounded-sm border border-ink/30 px-3 py-1 font-mono text-caption tracking-widest text-ink uppercase transition-colors hover:border-ink/60">
                      Unschedule
                    </button>
                  </form>
                </>
              )}
              <form action={deleteDraft}>
                <input type="hidden" name="id" value={d.id} />
                <button className="font-mono text-caption tracking-widest text-ink/50 uppercase underline-offset-4 hover:underline">
                  Discard
                </button>
              </form>
            </div>
          </li>
        ))}
        {drafts.length === 0 && <p className="font-body text-body text-ink/50">No drafts.</p>}
      </ul>
    </div>
  );
}
