import Link from "next/link";
import { CmsImage } from "@/components/CmsImage";

// Homepage modular sections (redesign v2 §4). Each takes a CMS value object
// (read on the page via lib/cms). All render Driftwood placeholders + sensible
// default copy when CMS is empty, so the homepage looks intentional pre-content.

type Img = { url?: string; alt?: string };

// ── §4.1 Hero collage ────────────────────────────────────────────────────────
export type HeroData = {
  left?: Img;
  rightTop?: Img;
  rightBottom?: Img;
  line1?: string;
  line2?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaShow?: boolean;
};

export function HeroCollage({ data }: { data: HeroData }) {
  const line1 = data.line1 || "Live by the tide";
  const line2 = data.line2 || "Coastal lifestyle, printed quietly.";
  const ctaText = data.ctaText || "Shop the collection";
  const ctaUrl = data.ctaUrl || "/shop";
  const showCta = data.ctaShow !== false;

  return (
    <section className="grid h-[70vh] grid-cols-1 gap-0 md:h-[90vh] md:grid-cols-[3fr_2fr]">
      {/* Left / main */}
      <div className="relative h-full">
        <CmsImage
          url={data.left?.url}
          alt={data.left?.alt}
          priority
          className="h-full w-full"
          sizes="(min-width:768px) 60vw, 100vw"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-deep-ink/15 px-6 text-center">
          <h1 className="font-display text-[clamp(3rem,7vw,5rem)] leading-[1.05] font-semibold text-hull-white drop-shadow-sm">
            {line1}
          </h1>
          {line2 && (
            <p className="mt-3 font-display text-[18px] text-hull-white italic drop-shadow-sm">
              {line2}
            </p>
          )}
          {showCta && (
            <Link
              href={ctaUrl}
              className="mt-7 inline-flex items-center rounded-sm bg-terracotta px-6 py-3 font-body text-[14px] font-medium text-hull-white no-underline transition-opacity hover:opacity-90"
            >
              {ctaText}
            </Link>
          )}
        </div>
      </div>
      {/* Right stack — hidden on mobile */}
      <div className="hidden grid-rows-2 gap-0 md:grid">
        <div className="relative">
          <CmsImage
            url={data.rightTop?.url}
            alt={data.rightTop?.alt}
            className="h-full w-full"
            sizes="40vw"
          />
        </div>
        <div className="relative">
          <CmsImage
            url={data.rightBottom?.url}
            alt={data.rightBottom?.alt}
            className="h-full w-full"
            sizes="40vw"
          />
        </div>
      </div>
    </section>
  );
}

// ── §4.3 Three-column editorial banner ───────────────────────────────────────
export type BannerColumn = { image?: Img; overlay?: boolean; heading?: string; url?: string };

export function EditorialBanner({ columns }: { columns: BannerColumn[] }) {
  const cols = columns.length ? columns : [{}, {}, {}];
  return (
    <section className="grid grid-cols-1 gap-0 md:grid-cols-3">
      {cols.slice(0, 3).map((c, i) => (
        <div key={i} className="relative h-[45vh] md:h-[55vh]">
          <CmsImage
            url={c.image?.url}
            alt={c.image?.alt}
            className="h-full w-full"
            sizes="(min-width:768px) 33vw, 100vw"
          />
          {c.overlay && (
            <div className="absolute inset-0 flex items-end p-6">
              <div className="bg-hull-white/90 px-5 py-4">
                <p className="font-body text-[16px] font-bold text-deep-ink">
                  {c.heading || "Shop the edit"}
                </p>
                <Link
                  href={c.url || "/shop"}
                  className="mt-1 inline-block font-body text-[13px] text-terracotta no-underline hover:underline"
                >
                  Shop Now →
                </Link>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// ── §4.4 Campaign title block ────────────────────────────────────────────────
export function CampaignTitle({
  heading,
  ctaText,
  ctaUrl,
}: {
  heading?: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  return (
    <section className="bg-hull-white px-6 py-18 text-center">
      <h2 className="font-display text-[clamp(2.75rem,5vw,4rem)] font-semibold text-deep-ink">
        {heading || "Live by the Tide"}
      </h2>
      <Link
        href={ctaUrl || "/shop"}
        className="mt-4 inline-block font-body text-[16px] font-medium text-deep-ink no-underline decoration-terracotta decoration-2 underline-offset-4 hover:underline"
      >
        {ctaText || "Discover the Collection"} →
      </Link>
    </section>
  );
}

// ── §4.5 Three-column tall photo strip ───────────────────────────────────────
export function PhotoStrip({ images }: { images: Img[] }) {
  const imgs = images.length ? images : [{}, {}, {}];
  return (
    <section className="grid grid-cols-1 gap-0 md:grid-cols-3">
      {imgs.slice(0, 3).map((img, i) => (
        <div key={i} className="relative h-[50vh] md:h-[65vh]">
          <CmsImage
            url={img.url}
            alt={img.alt}
            className="h-full w-full"
            sizes="(min-width:768px) 33vw, 100vw"
          />
        </div>
      ))}
    </section>
  );
}

// ── §4.6 Category tiles ("New Arrivals") ─────────────────────────────────────
export type Tile = { image?: Img; label?: string; url?: string; row?: "women" | "men" };

const DEFAULT_TILES: Tile[] = [
  { label: "Bikinis", url: "/collections/bikini-sets", row: "women" },
  { label: "Dresses", url: "/collections/dresses", row: "women" },
  { label: "Swimsuits", url: "/collections/one-piece-swimsuit", row: "women" },
  { label: "Hoodies", url: "/collections/womens-hoodies", row: "women" },
  { label: "Boardshorts", url: "/collections/boardshorts", row: "men" },
  { label: "Hoodies", url: "/collections/mens-hoodies", row: "men" },
  { label: "Swimwear", url: "/collections/mens-swimwear", row: "men" },
  { label: "Tee's & Tanks", url: "/collections/mens-tees-tanks", row: "men" },
];

function TileRow({ label, tiles }: { label: string; tiles: Tile[] }) {
  return (
    <div>
      <p className="mb-3 font-body text-[12px] font-medium text-driftwood-tan">{label}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <Link key={i} href={t.url || "/shop"} className="group block no-underline">
            <div className="relative aspect-square overflow-hidden rounded-sm">
              <CmsImage
                url={t.image?.url}
                alt={t.image?.alt || t.label}
                className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
                sizes="(min-width:640px) 22vw, 45vw"
              />
            </div>
            <p className="mt-2 font-body text-[13px] font-semibold tracking-[0.03em] text-deep-ink">
              {t.label}
            </p>
            <span className="font-body text-[12px] text-terracotta">View all →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CategoryTiles({ tiles }: { tiles: Tile[] }) {
  const all = tiles.length ? tiles : DEFAULT_TILES;
  const women = all.filter((t) => t.row !== "men");
  const men = all.filter((t) => t.row === "men");
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-16 lg:px-6">
      <h2 className="mb-8 text-center font-body text-[26px] font-bold text-deep-ink">
        New Arrivals
      </h2>
      <div className="space-y-10">
        <TileRow label="Women's" tiles={women} />
        <TileRow label="Men's" tiles={men} />
      </div>
    </section>
  );
}
