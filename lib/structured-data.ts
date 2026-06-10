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
