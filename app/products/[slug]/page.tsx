import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { VariantSelector } from "@/components/storefront/VariantSelector";
import { ProductGrid } from "@/components/ProductGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { ProductReviews } from "@/components/storefront/ProductReviews";
import { RecentlyViewed } from "@/components/storefront/RecentlyViewed";
import { getProductBySlug, getProductSlugs, getRelatedProducts, primaryImage } from "@/lib/queries";
import { productLd, breadcrumbLd } from "@/lib/structured-data";
import { getProductReviews, summarizeReviews } from "@/lib/reviews";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };
  const img = primaryImage(product);
  const description = product.seo_description || product.description?.slice(0, 160) || undefined;
  return {
    title: product.seo_title || product.title,
    description,
    alternates: { canonical: absoluteUrl(`/products/${product.slug}`) },
    openGraph: {
      type: "website",
      title: product.seo_title || product.title,
      description,
      url: absoluteUrl(`/products/${product.slug}`),
      ...(img ? { images: [{ url: img.url, alt: img.alt }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, reviews] = await Promise.all([
    getRelatedProducts(product.id),
    getProductReviews(product.id),
  ]);
  const reviewSummary = summarizeReviews(reviews);

  const images = [...(product.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const hero = primaryImage(product);

  return (
    <Container className="py-12">
      <JsonLd data={productLd(product, { summary: reviewSummary, items: reviews })} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Shop", path: "/shop" },
          { name: product.title, path: `/products/${product.slug}` },
        ])}
      />

      <nav className="mb-8 font-mono text-caption tracking-wide text-ink/50 uppercase">
        <Link href="/shop" className="hover:text-accent-sun">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink/80">{product.title}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface-2">
            {hero ? (
              <Image
                src={hero.url}
                alt={hero.alt}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-display text-5xl text-ink/15">N</span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {images.slice(0, 8).map((im) => (
                <div
                  key={im.id}
                  className="relative aspect-square overflow-hidden rounded-sm bg-surface-2"
                >
                  <Image
                    src={im.url}
                    alt={im.alt || product.title}
                    fill
                    sizes="20vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:pt-6">
          <h1 className="font-display text-heading tracking-tight text-ink">{product.title}</h1>
          <div className="mt-6">
            <VariantSelector product={product} />
          </div>
          {product.description && (
            <div className="mt-10 border-t border-ink/10 pt-8">
              <p className="whitespace-pre-line font-body text-body leading-relaxed text-ink/80">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <ProductReviews
        productId={product.id}
        slug={product.slug}
        reviews={reviews}
        summary={reviewSummary}
      />

      {related.length > 0 && (
        <section className="mt-24 border-t border-ink/10 pt-12">
          <h2 className="mb-8 font-display text-heading tracking-tight text-ink">
            You may also like
          </h2>
          <ProductGrid products={related} />
        </section>
      )}

      <RecentlyViewed
        current={{
          id: product.id,
          slug: product.slug,
          title: product.title,
          price: product.price,
          currency: product.currency,
          imageUrl: hero?.url ?? null,
        }}
      />
    </Container>
  );
}
