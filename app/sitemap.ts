import type { MetadataRoute } from "next";
import { absoluteUrl, allowIndexing } from "@/lib/site";
import { getProductSlugs, getCollections } from "@/lib/queries";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pre-launch: serve an empty sitemap (paired with robots disallow).
  if (!allowIndexing) return [];

  const [slugs, collections] = await Promise.all([getProductSlugs(), getCollections()]);
  const staticPaths = ["/", "/shop", "/about", "/contact", "/shipping-returns", "/size-guide"];

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
  ];
}
