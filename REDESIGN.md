# Nautical Nomads — Billabong-inspired Redesign (v2, phased)

Brief v2 supersedes v1. Reference: **Billabong** (clean geometric sans + elegant serif display).

Resolved decisions (brief v2 §0):

- Fonts: **Cormorant Garamond** (display/hero) + **DM Sans** (nav/body/heading/meta). All of
  Montserrat / Inter / Barlow / Barlow Condensed / JetBrains Mono removed.
- Tailwind v4: tokens in `globals.css` `@theme` (no config file).
- Full feature build (backend in scope): collections taxonomy, CMS, wishlist, newsletter.
- Newsletter: Resend + Supabase only (insert + Resend welcome email).
- No SOLD OUT (POD); "NEW" derived from published_at < 30 days; logo stays placeholder.
- Category strategy: seed taxonomy collections as DRAFTS; owner assigns products via admin;
  nav shows only published collections with >=1 product; never 404 — graceful "coming soon".

Schema reconciliations (existing repo vs v2 SQL):

- `collections` + `collection_products` already exist (empty) -> ALTER to add gender/parent_slug/
  status/hero_image_url; keep existing `title` (alias of v2 `name`).
- v2 `product_variants` -> our table is `variants`.

## Phases (brief v2 §12)

1. 🟡 Foundation — fonts ✅, colour tokens ✅; DB migrations ⬜ (SQL handed to owner).
2. 🟡 Header & nav — gender bar ✅, main header ✅, desktop mega menu ✅, mobile drawer ✅.
3. ✅ Footer — newsletter band (Resend wired) + scrolling tag row (CMS) + 3 columns + bottom bar.
4. ✅ Homepage — hero collage + featured carousel + 3-col banner + campaign title + photo strip + New Arrivals tiles (all CMS-driven, Driftwood placeholders).
5. ✅ Admin CMS — "Homepage & Content" tab (hero/carousel/banner/campaign/strip/tiles/mega/footer-tags/newsletter managers, uploads to cms-assets) + "Collections" tab (list, edit+assign, bulk tagger). 47 taxonomy collections seeded as drafts.
6. ✅ PLP & product card — collection hero + sub-nav tabs + client filter sidebar (colour/size/price/sort) + result count + quick-add hover + NEW badge + wishlist heart; empty collections show graceful coming-soon.
7. ⬜ Wishlist — endpoints + header/card/page, guest localStorage + merge on sign-in.
8. ⬜ Static pages — all of §9.
9. ⬜ QA — WCAG AA, responsive, Lighthouse, no regressions, no 404 collections.

## Notes

- `font-display` (Cormorant) now applies to existing headings site-wide -> headings render serif.
  Per-component refinement can follow.
- Storefront header still shows above /admin + /account (pre-existing) — tidy in a later pass.
