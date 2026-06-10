import type { MetadataRoute } from "next";
import { absoluteUrl, allowIndexing } from "@/lib/site";
import { getProductSlugs, getCollections, getPublishedPostSlugs } from "@/lib/queries";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pre-launch: serve an empty sitemap (paired with robots disallow).
  if (!allowIndexing) return [];

  const [slugs, collections, postSlugs] = await Promise.all([
    getProductSlugs(),
    getCollections(),
    getPublishedPostSlugs(),
  ]);
  const staticPaths = [
    "/",
    "/shop",
    "/journal",
    "/about",
    "/our-story",
    "/sustainability",
    "/ambassadors",
    "/contact",
    "/help",
    "/gift-cards",
    "/student-discount",
    "/careers",
    "/payment-methods",
    "/shipping",
    "/shipping-returns",
    "/returns",
    "/size-guide",
    "/privacy",
    "/terms-of-sale",
    "/terms-of-use",
    "/cookies",
  ];

  return [
    ...staticPaths.map((p) => ({ url: absoluteUrl(p), changeFrequency: "weekly" as const })),
    ...collections.map((c) => ({
      url: absoluteUrl(`/collections/${c.slug}`),
      changeFrequency: "weekly" as const,
    })),
    ...slugs.map((s) => ({
      url: absoluteUrl(`/products/${s}`),
      changeFrequency: "weekly" as const,
    })),
    ...postSlugs.map((s) => ({
      url: absoluteUrl(`/journal/${s}`),
      changeFrequency: "monthly" as const,
    })),
  ];
}
