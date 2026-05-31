# Nautical Nomads — Roxy-inspired Redesign (phased)

Tracking the layout/nav/CMS overhaul. Decisions (owner-approved):

- Taxonomy: re-migrate the 44 Shopify collections to back the new nav.
- Scope: full brief, phased, reviewed on the branch preview URL.
- Fonts: Barlow Condensed / Barlow / Inter (replaces Montserrat/DM Sans/JetBrains).
- Newsletter signups → Resend Audience.

Defaults agreed for missing data:

- No stock field → drop "SOLD OUT"; treat all as in stock.
- "NEW" badge derived from published_at within ~30 days.
- Logo stays a text placeholder until the Nn SVG is provided.
- Accessories subcategories + Gift Card product: shells now, specifics later.

## Phases (§10 order)

1. ✅ Design tokens — fonts (Barlow Condensed/Barlow/Inter) + Horizon colour aliases.
2. ⬜ Header — utility bar + main header + mobile drawer.
3. ⬜ Mega menu — desktop hover + mobile accordion.
4. ⬜ Footer — newsletter band + tag row + main footer + bottom bar.
5. ⬜ Homepage sections — hero collage → carousel → 3-col banner → title block → photo strip → trends tiles.
6. ⬜ Admin CMS tab — "Homepage & Content" managers + cms_homepage_content table + cms-assets bucket.
7. ⬜ PLP — sub-nav tabs + filter sidebar + product-card hover quick-add.
8. ⬜ Wishlist — wishlists table + header/card/page UI.
9. ⬜ Static pages — about, ambassadors, sustainability, blog, gift cards, help, shipping, returns, size guide, legal.
10. ⬜ QA — WCAG AA, responsiveness, Lighthouse.

Plus Phase 0 (data): re-migrate Shopify collections → collections + collection_products,
and a static nav config mapping MEN/WOMEN/ACCESSORIES → category → subcategory → collection slug.

## Phase 1 notes

- `lib/fonts.ts`: Barlow Condensed (600/700), Barlow (600/700/800 + italic), Inter (400/500/600/700).
- `globals.css` `@theme`: `--font-display`=Barlow Condensed, `--font-editorial`=Barlow, `--font-body`/`--font-mono`=Inter; added `terracotta`/`faded-denim`/`driftwood-tan`/`hull-white`/`driftwood`/`deep-ink` colour aliases (same hexes). Existing `surface`/`ink`/`accent-*` tokens kept so current pages don't break.
