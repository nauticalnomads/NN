import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { ProductGrid } from "@/components/ProductGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCollectionBySlug, getCollections } from "@/lib/queries";
import { breadcrumbLd } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getCollections()).map((c) => ({ slug: c.slug }));
}

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

  return (
    <Container className="py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Collections", path: "/shop" },
          { name: collection.title, path: `/collections/${collection.slug}` },
        ])}
      />
      <h1 className="font-display text-display-2 tracking-tight text-ink">{collection.title}</h1>
      {collection.description && (
        <p className="mt-4 max-w-xl font-body text-body leading-relaxed text-ink/70">
          {collection.description}
        </p>
      )}
      <div className="mt-10">
        <ProductGrid products={products} />
      </div>
    </Container>
  );
}
