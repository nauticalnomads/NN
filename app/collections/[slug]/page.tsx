import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { JsonLd } from "@/components/seo/JsonLd";
import { PlpFilters } from "@/components/storefront/PlpFilters";
import { getCollectionBySlug, getChildCollections } from "@/lib/queries";
import { breadcrumbLd } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/site";

// Rendered per-request. We deliberately do NOT prerender via generateStaticParams:
// with zero published collections that returns an empty list, and an ISR route
// with no prerendered fallback 500s on the Cloudflare Workers adapter for every
// path (incl. notFound). Dynamic rendering reads live data and 404s cleanly.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCollectionBySlug(slug);
  if (!result) return { title: "Not found" };
  const { collection } = result;
  return {
    title: collection.seo_title || collection.title,
    description: collection.seo_description || collection.description || undefined,
    alternates: { canonical: absoluteUrl(`/collections/${collection.slug}`) },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getCollectionBySlug(slug);
  if (!result) notFound();

  const { collection, products } = result;
  const col = collection as unknown as {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    parent_slug: string | null;
    hero_image_url: string | null;
  };

  // Sub-nav tabs: children of THIS collection, or siblings if this is a leaf.
  const tabParent = col.parent_slug || col.slug;
  const children = await getChildCollections(tabParent);

  return (
    <div>
      {/* §5.1 Collection hero */}
      {col.hero_image_url ? (
        <div className="relative h-[35vh] min-h-56 w-full overflow-hidden">
          <Image src={col.hero_image_url} alt={col.title} fill className="object-cover" priority />
          <div className="absolute inset-0 flex items-center justify-center bg-deep-ink/25">
            <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] font-semibold text-hull-white">
              {col.title}
            </h1>
          </div>
        </div>
      ) : (
        <div className="bg-driftwood">
          <Container className="py-12">
            <h1 className="font-display text-display-2 font-semibold tracking-tight text-deep-ink">
              {col.title}
            </h1>
            {col.description && (
              <p className="mt-3 max-w-xl font-body text-body text-ink/70">{col.description}</p>
            )}
          </Container>
        </div>
      )}

      {/* §5.2 Sub-nav tabs */}
      {(children.length > 0 || col.parent_slug) && (
        <div className="border-b border-ink/10 bg-hull-white">
          <Container>
            <div className="flex gap-1 overflow-x-auto py-1">
              <Tab
                href={`/collections/${tabParent}`}
                active={col.slug === tabParent}
                label="View All"
              />
              {children.map((c) => (
                <Tab
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  active={c.slug === col.slug}
                  label={c.title}
                />
              ))}
            </div>
          </Container>
        </div>
      )}

      <Container className="py-10">
        <JsonLd
          data={breadcrumbLd([
            { name: "Shop", path: "/shop" },
            { name: col.title, path: `/collections/${col.slug}` },
          ])}
        />
        {products.length === 0 ? (
          <div className="rounded-sm border border-dashed border-ink/20 py-20 text-center">
            <p className="font-body text-body text-ink/55">
              This collection is coming soon. Check back shortly, or{" "}
              <Link href="/shop" className="text-terracotta-text no-underline hover:underline">
                browse everything
              </Link>
              .
            </p>
          </div>
        ) : (
          <PlpFilters products={products} />
        )}
      </Container>
    </div>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`shrink-0 border-b-2 px-4 py-3 font-body text-[13px] font-medium whitespace-nowrap no-underline transition-colors ${
        active
          ? "border-terracotta text-deep-ink"
          : "border-transparent text-ink/60 hover:text-deep-ink"
      }`}
    >
      {label}
    </Link>
  );
}
