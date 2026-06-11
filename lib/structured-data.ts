import { site, absoluteUrl } from "@/lib/site";
import type { ProductWithRelations } from "@/lib/product";
import { primaryImage } from "@/lib/product";

// Social profiles — feeds the Google knowledge panel via sameAs.
const SOCIAL_PROFILES = [
  "https://www.instagram.com/thenauticalnomads/",
  "https://www.facebook.com/thenauticalnomad",
  "https://www.youtube.com/@nauticalnomads1",
];

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    slogan: site.tagline,
    description: site.description,
    sameAs: SOCIAL_PROFILES,
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    description: site.description,
  };
}

export function breadcrumbLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function articleLd(post: {
  title: string;
  slug: string;
  seo_description?: string | null;
  cover_image_url?: string | null;
  published_at?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    url: absoluteUrl(`/journal/${post.slug}`),
    ...(post.seo_description ? { description: post.seo_description } : {}),
    ...(post.cover_image_url ? { image: [post.cover_image_url] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    author: { "@type": "Organization", name: site.name },
    publisher: { "@type": "Organization", name: site.name },
  };
}

export function collectionLd(collection: {
  title: string;
  slug: string;
  description?: string | null;
  seo_description?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.title,
    url: absoluteUrl(`/collections/${collection.slug}`),
    description: collection.seo_description || collection.description || site.description,
    isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
  };
}

export function productLd(product: ProductWithRelations) {
  const img = primaryImage(product);
  const prices = [product.price, ...(product.variants ?? []).map((v) => v.price)].filter(
    (p) => typeof p === "number",
  );
  const low = Math.min(...(prices.length ? prices : [product.price]));
  const high = Math.max(...(prices.length ? prices : [product.price]));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.seo_description || product.description || site.description,
    ...(img ? { image: [img.url] } : {}),
    sku: product.variants?.[0]?.sku,
    brand: { "@type": "Brand", name: site.name },
    offers:
      low === high
        ? {
            "@type": "Offer",
            price: low.toFixed(2),
            priceCurrency: product.currency,
            availability: "https://schema.org/InStock",
            url: absoluteUrl(`/products/${product.slug}`),
          }
        : {
            "@type": "AggregateOffer",
            lowPrice: low.toFixed(2),
            highPrice: high.toFixed(2),
            priceCurrency: product.currency,
            availability: "https://schema.org/InStock",
            offerCount: product.variants?.length || 1,
          },
  };
}
