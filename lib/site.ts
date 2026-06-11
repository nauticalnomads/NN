// Central site config. Domain lives in an env var so the eventual
// Domain lives in NEXT_PUBLIC_SITE_URL; default is the live nauticalnomads.com.
export const site = {
  name: "Nautical Nomads",
  tagline: "Live by the tide.",
  description:
    "Coastal lifestyle clothing, printed quietly. For everyone drifting toward the water.",
  // No trailing slash. Override per-environment with NEXT_PUBLIC_SITE_URL.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nauticalnomads.com").replace(/\/$/, ""),
  established: "MMXXIII",
} as const;

// Indexing is now ON by default (the site is live). It emits noindex + robots
// disallow ONLY when NEXT_PUBLIC_ALLOW_INDEXING is explicitly "false" — set that
// on any preview/staging deploy you want kept out of search engines.
export const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "false";

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
