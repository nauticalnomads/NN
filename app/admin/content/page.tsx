import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCmsValues } from "@/lib/cms";
import Link from "next/link";
import { FooterTagEditor } from "./FooterTagEditor";
import { ImageSlot } from "./ImageSlot";
import {
  saveHero,
  saveBanner,
  saveCampaign,
  saveStrip,
  saveTiles,
  saveCarousel,
  saveNewsletterSettings,
} from "./actions";

type V = Record<string, unknown>;
const get = (o: V, k: string) => (o?.[k] as string) ?? "";

// Small building blocks ───────────────────────────────────────────────────────
function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-ink/10 p-5">
      <h2 className="font-display text-heading text-ink">{title}</h2>
      {desc && <p className="mt-1 mb-4 font-body text-caption text-ink/55">{desc}</p>}
      <div className={desc ? "" : "mt-4"}>{children}</div>
    </section>
  );
}
function Text({
  name,
  label,
  def = "",
  placeholder = "",
}: {
  name: string;
  label: string;
  def?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={def}
        placeholder={placeholder}
        className="mt-1.5 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
      />
    </label>
  );
}
// Link target picker — a dropdown of existing collections (+ Home / Shop). Keeps
// any pre-existing custom value selectable so saved links aren't lost.
function LinkField({
  name,
  label,
  def = "",
  options,
}: {
  name: string;
  label: string;
  def?: string;
  options: { value: string; label: string }[];
}) {
  const known = new Set(["", "/", "/shop", ...options.map((o) => o.value)]);
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <select
        name={name}
        defaultValue={def}
        className="mt-1.5 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
      >
        <option value="">— No link —</option>
        <option value="/">Home (/)</option>
        <option value="/shop">All products (/shop)</option>
        {def && !known.has(def) && <option value={def}>{def} (current)</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Save({ label = "Save" }: { label?: string }) {
  return (
    <button className="mt-4 rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase">
      {label}
    </button>
  );
}
function Toggle({ name, label, def }: { name: string; label: string; def?: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={def}
        className="h-4 w-4 accent-accent-sun"
      />
      <span className="font-body text-body text-ink">{label}</span>
    </label>
  );
}

export default async function AdminContent() {
  await requireStaff();
  const cms = await getCmsValues([
    "home.hero",
    "home.banner",
    "home.campaign",
    "home.strip",
    "home.tiles",
    "home.carousel1",
    "footer.tags",
    "newsletter.settings",
  ]);

  // Published collections — for the carousel picker and the link dropdowns.
  const sb = createServiceClient();
  const { data: pub } = await sb
    .from("collections")
    .select("slug, title, parent_slug, gender")
    .eq("status", "published")
    .order("gender")
    .order("title");
  const collections =
    (pub as unknown as {
      slug: string;
      title: string;
      parent_slug: string | null;
      gender: string | null;
    }[]) ?? [];
  // Readable link options: "/collections/<slug>" with a breadcrumb-ish label.
  const titleBySlug = Object.fromEntries(collections.map((c) => [c.slug, c.title]));
  const linkOptions = collections.map((c) => {
    const parent = c.parent_slug ? titleBySlug[c.parent_slug] : "";
    const label = parent ? `${parent} › ${c.title}` : c.title;
    return { value: `/collections/${c.slug}`, label };
  });

  const hero = (cms["home.hero"] ?? {}) as V;
  const heroImg = (k: string) => (hero[k] as { url?: string; alt?: string }) ?? {};
  const banner = ((cms["home.banner"] as { columns?: V[] })?.columns ?? []) as V[];
  const campaign = (cms["home.campaign"] ?? {}) as V;
  const strip = ((cms["home.strip"] as { images?: V[] })?.images ?? []) as V[];
  const tiles = ((cms["home.tiles"] as { tiles?: V[] })?.tiles ?? []) as V[];
  const carousel = (cms["home.carousel1"] ?? {}) as V;
  const footerTags = ((cms["footer.tags"] as { tags?: { label: string; href: string }[] })?.tags ??
    []) as {
    label: string;
    href: string;
  }[];
  const nl = (cms["newsletter.settings"] ?? {}) as V;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-display-2 tracking-tight text-ink">
          Homepage &amp; Content
        </h1>
        <p className="mt-2 font-body text-body text-ink/60">
          Images upload to Supabase Storage and show live on save — no redeploy.
        </p>
      </div>

      {/* Hero */}
      <Card title="Hero collage" desc="Three-image mosaic + overlay text and CTA (§4.1).">
        <form action={saveHero} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <ImageSlot
              name="left"
              label="Hero Left (large)"
              current={heroImg("left").url}
              rec="1200×900px"
            />
            <ImageSlot
              name="rightTop"
              label="Hero Right Top"
              current={heroImg("rightTop").url}
              rec="800×600px"
            />
            <ImageSlot
              name="rightBottom"
              label="Hero Right Bottom"
              current={heroImg("rightBottom").url}
              rec="800×600px"
            />
          </div>
          <Text
            name="line1"
            label="Display line 1"
            def={get(hero, "line1")}
            placeholder="High Summer"
          />
          <Text name="line2" label="Display line 2 (tagline)" def={get(hero, "line2")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text
              name="ctaText"
              label="CTA text"
              def={get(hero, "ctaText")}
              placeholder="Shop the collection"
            />
            <LinkField
              name="ctaUrl"
              label="CTA link"
              def={get(hero, "ctaUrl")}
              options={linkOptions}
            />
          </div>
          <Toggle name="ctaShow" label="Show CTA button" def={hero.ctaShow !== false} />
          <Save />
        </form>
      </Card>

      {/* Carousel */}
      <Card
        title="Featured carousel"
        desc="Heading + which published collection populates it (§4.2)."
      >
        <form action={saveCarousel} className="space-y-3">
          <Text
            name="heading"
            label="Section heading"
            def={get(carousel, "heading")}
            placeholder="New Arrivals"
          />
          <label className="block">
            <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
              Collection
            </span>
            <select
              name="collection"
              defaultValue={get(carousel, "collection")}
              className="mt-1.5 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
            >
              <option value="">Featured products (default)</option>
              {collections.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <Toggle name="show" label="Show carousel" def={carousel.show !== false} />
          <Save />
        </form>
      </Card>

      {/* Banner */}
      <Card title="Editorial banner" desc="Three columns, optional overlay each (§4.3).">
        <form action={saveBanner} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => {
              const c = (banner[i] ?? {}) as V;
              const img = (c.image as { url?: string }) ?? {};
              return (
                <div key={i} className="space-y-2">
                  <ImageSlot
                    name={`col${i}`}
                    label={`Column ${i + 1}`}
                    current={img.url}
                    rec="900×1100px"
                  />
                  <Toggle name={`col${i}_overlay`} label="Overlay" def={!!c.overlay} />
                  <Text name={`col${i}_heading`} label="Heading" def={get(c, "heading")} />
                  <LinkField
                    name={`col${i}_url`}
                    label="Link"
                    def={get(c, "url")}
                    options={linkOptions}
                  />
                </div>
              );
            })}
          </div>
          <Save />
        </form>
      </Card>

      {/* Campaign */}
      <Card title="Campaign title" desc="Centred heading + CTA (§4.4).">
        <form action={saveCampaign} className="space-y-3">
          <Text
            name="heading"
            label="Heading"
            def={get(campaign, "heading")}
            placeholder="Live by the Tide"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text
              name="ctaText"
              label="CTA text"
              def={get(campaign, "ctaText")}
              placeholder="Discover the Collection"
            />
            <LinkField
              name="ctaUrl"
              label="CTA link"
              def={get(campaign, "ctaUrl")}
              options={linkOptions}
            />
          </div>
          <Save />
        </form>
      </Card>

      {/* Photo strip */}
      <Card title="Photo strip" desc="Three tall editorial images, no text (§4.5).">
        <form action={saveStrip} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => {
              const img = (strip[i] ?? {}) as { url?: string };
              return (
                <ImageSlot
                  key={i}
                  name={`img${i}`}
                  label={`Strip ${i + 1}`}
                  current={img.url}
                  rec="900×1200px"
                />
              );
            })}
          </div>
          <Save />
        </form>
      </Card>

      {/* Tiles */}
      <Card title="Category tiles" desc="New Arrivals — 4 Women's + 4 Men's (§4.6).">
        <form action={saveTiles} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => {
              const t = (tiles[i] ?? {}) as V;
              const img = (t.image as { url?: string }) ?? {};
              return (
                <div key={i} className="space-y-2 rounded-sm border border-ink/10 p-2">
                  <ImageSlot
                    name={`tile${i}`}
                    label={`Tile ${i + 1}`}
                    current={img.url}
                    rec="800×800px"
                  />
                  <Text name={`tile${i}_label`} label="Label" def={get(t, "label")} />
                  <LinkField
                    name={`tile${i}_url`}
                    label="Link"
                    def={get(t, "url")}
                    options={linkOptions}
                  />
                  <label className="block">
                    <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
                      Row
                    </span>
                    <select
                      name={`tile${i}_row`}
                      defaultValue={(t.row as string) || (i < 4 ? "women" : "men")}
                      className="mt-1 block w-full rounded-sm border border-ink/20 bg-surface px-2 py-1.5 font-body text-caption"
                    >
                      <option value="women">Women&apos;s</option>
                      <option value="men">Men&apos;s</option>
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
          <Save />
        </form>
      </Card>

      {/* Mega menu images — now driven by each collection's cover photo */}
      <Card title="Mega menu images" desc="Driven by the live collection taxonomy (§2.3).">
        <p className="font-body text-body text-ink/70">
          The mega menu is generated automatically from your published collections, and each
          category&apos;s image is its <strong>cover photo</strong>. Set or change them per category
          in{" "}
          <Link href="/admin/collections" className="text-accent-sun underline">
            Collections
          </Link>{" "}
          → open a category → <em>Cover photo</em>. Publishing/unpublishing a collection shows or
          hides it in the menu.
        </p>
      </Card>

      {/* Footer tags */}
      <Card title="Footer tag row" desc="Pill links in the footer (§6.2). Max 20.">
        <FooterTagEditor initial={footerTags} />
      </Card>

      {/* Newsletter */}
      <Card title="Newsletter settings" desc="Welcome discount code sent on signup (§7.9).">
        <form action={saveNewsletterSettings} className="space-y-3">
          <Text name="code" label="Discount code" def={get(nl, "code") || "WELCOME10"} />
          <Save />
        </form>
      </Card>
    </div>
  );
}
