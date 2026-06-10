# SEO & Old-Site Link Audit — Nautical Nomads

_Audit date: June 2026. Covers indexing readiness and the Shopify → Cloudflare
link migration. Companion to `DOMAIN_CUTOVER.md` and `RUNBOOK.md`._

## TL;DR — the three things that actually matter

1. **🔴 Re-run the redirect generator against the live Shopify store before you
   close it.** `lib/redirects.json` currently has only ~9 product + a handful of
   page redirects. The generator (`scripts/generate-redirects.mjs`) pulls the
   _full_ product + collection list from Shopify and maps every old URL to its
   new home — but it must be run while Shopify is still reachable. Once Shopify
   is gone, those old URLs (and their Google ranking) are unrecoverable.

   ```bash
   node --env-file=.env.local scripts/generate-redirects.mjs
   ```

   Needs `SHOPIFY_*` + Supabase env vars set locally. Commit the regenerated
   `lib/redirects.json` and deploy **before** decommissioning Shopify.

2. **🔴 Flip indexing on at go-live.** `NEXT_PUBLIC_ALLOW_INDEXING` is `false`,
   so right now `robots.txt` is `Disallow: /`, the sitemap is empty, and every
   page emits `noindex`. Nothing will be indexed until this is set to `true` as
   a **build** variable and redeployed (see `RUNBOOK.md` §2 for the build-vs-
   runtime gotcha).

3. **🟠 Submit the sitemap in Google Search Console** after go-live: add the
   `nauticalnomads.com` property and submit `/sitemap.xml`. Request indexing for
   the homepage + top products.

---

## What's already in good shape ✅

- **Canonical URLs** on every product, collection, and journal page
  (`alternates.canonical`) + on the static pages.
- **Per-page metadata** via `generateMetadata` (titles, descriptions, OpenGraph)
  on products, collections, and journal posts; a sensible title template +
  `metadataBase` in the root layout.
- **Structured data (JSON-LD):** `Organization` + `WebSite` site-wide, `Product`
  (with Offer/AggregateOffer) on PDPs, `Article` on journal posts,
  `BreadcrumbList` helper available.
- **Canonical host redirect:** `www.*` and the legacy hyphen domain 308 → apex
  (`middleware.ts`).
- **Sitemap & robots** are correctly gated on the indexing flag.

## What this audit changed 🔧

- **`/blogs/:path*` → `/journal`** redirect added (Shopify's blog lived under
  `/blogs/...`; these were 404ing). Added to both the live `redirects.json` and
  the generator so it survives a re-run.
- **Collections now map to real pages.** The generator previously dumped every
  old `/collections/{handle}` onto `/shop`; it now maps to the matching new
  collection page (by migrated id, else same-named slug) and only falls back to
  `/shop` when there's genuinely no equivalent — far better for ranking.
- **Bare `/collections` and `/products`** roots redirect to `/shop`.
- **Sitemap expanded** to include all indexable static pages (our-story,
  gift-cards, student-discount, careers, payment-methods, shipping, returns,
  size-guide, sustainability, ambassadors, legal pages).
- **`Organization` schema** now lists the real social profiles via `sameAs`
  (Instagram/Facebook/YouTube) for the knowledge panel.

## Recommended next (not blocking) 🟡

- **Default OpenGraph image.** Products share their own image, but the homepage,
  collections, journal index, and static pages have no social-share image, so
  link previews are bare. Add a branded default (a wide cover would be ideal —
  the same ones used for emails) referenced from the root layout's
  `openGraph.images`, or generate one dynamically with `next/og`.
- **Per-collection / journal OG images** (collections + journal index currently
  inherit the site default).
- **Internal linking:** link journal posts to relevant collections/products
  (the post body supports links) to spread link equity once published.
- **Product reviews schema** (`AggregateRating`) once you collect reviews — rich
  stars in SERPs.

## Old-site URL coverage map

| Old Shopify pattern                                        | New destination                                                 | Handled by          |
| ---------------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| `/products/{handle}`                                       | `/products/{slug}` (or `/shop` if dropped)                      | generator (re-run!) |
| `/collections/{handle}`                                    | matching collection page, else `/shop`                          | generator (re-run!) |
| `/collections/{c}/products/{h}`                            | Google canonicalises these to `/products/{h}`, which is covered | —                   |
| `/blogs/{blog}/{article}`                                  | `/journal`                                                      | ✅ static redirect  |
| `/pages/{about,contact,shipping,returns,faq,size-guide,…}` | mapped equivalents                                              | ✅ static redirect  |
| `/collections`, `/products` (roots)                        | `/shop`                                                         | ✅ static redirect  |

> The collection-scoped product URLs (`/collections/x/products/y`) are left to
> Google's canonical (Shopify always canonicalised them to `/products/y`), so
> the `/products/{handle}` redirect covers the indexed version. If analytics
> later show traffic on those exact paths, add a wildcard rule.
