import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/service";
import { driveThumbnailUrl } from "@/lib/google-drive";

const INSTAGRAM_URL = "https://www.instagram.com/thenauticalnomads/";

// Homepage UGC strip that closes the social-autopilot loop: the photos the
// scheduler has actually published (social_drafts status=posted) come back onto
// the site as an Instagram gallery, each tile linking to the profile.
// Best-effort server component: any failure or an empty feed renders nothing.
export async function InstagramGallery() {
  let tiles: { id: string; image_ref: string }[] = [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("social_drafts")
      .select("id, image_ref, posted_at")
      .eq("status", "posted")
      .not("image_ref", "is", null)
      .order("posted_at", { ascending: false })
      .limit(12);
    const rows = (data as unknown as { id: string; image_ref: string }[]) ?? [];
    // De-dupe by image (the queue can repeat photos when the library is small).
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.image_ref)) continue;
      seen.add(r.image_ref);
      tiles.push(r);
      if (tiles.length === 8) break;
    }
  } catch {
    tiles = [];
  }
  if (tiles.length === 0) return null;

  return (
    <section className="border-t border-ink/10 py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-heading tracking-tight text-ink">Life by the tide</h2>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-caption tracking-widest text-terracotta-text uppercase no-underline underline-offset-4 hover:underline"
          >
            @thenauticalnomads →
          </a>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-1.5 sm:gap-2">
          {tiles.map((t) => (
            <a
              key={t.id}
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-square overflow-hidden rounded-sm bg-surface-2"
            >
              <Image
                src={driveThumbnailUrl(t.image_ref, 600)}
                alt="Nautical Nomads on Instagram"
                fill
                unoptimized
                sizes="(min-width: 1024px) 270px, 25vw"
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
