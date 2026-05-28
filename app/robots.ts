import type { MetadataRoute } from "next";
import { absoluteUrl, allowIndexing, site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Pre-launch: disallow everything. No sitemap reference (don't advertise URLs
  // we don't want crawled). Flip NEXT_PUBLIC_ALLOW_INDEXING=true at cutover.
  if (!allowIndexing) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
