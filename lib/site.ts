// Central site config. Domain lives in an env var so the eventual
// nautical-nomads.com → nauticalnomads.com cutover is a one-line change.
export const site = {
  name: "Nautical Nomads",
  tagline: "Live by the tide.",
  description:
    "Coastal lifestyle clothing, printed quietly. For everyone drifting toward the water.",
  // No trailing slash. Override per-environment with NEXT_PUBLIC_SITE_URL.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nautical-nomads.com").replace(/\/$/, ""),
  established: "MMXXIII",
} as const;

// Indexing is OPT-IN: unless NEXT_PUBLIC_ALLOW_INDEXING is explicitly "true",
// the site emits noindex + robots disallow. That keeps the pre-launch hyphen
// domain (and any preview deploys) out of search engines by default, and the
// cutover is a single env var flip.
export const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
