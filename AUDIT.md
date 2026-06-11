# Nautical Nomads — Site & Admin Audit

_Date: 2026-06-11 · Scope: full storefront + admin functionality, links, SEO, and
competitive comparison. Code-level fixes from this audit are noted inline and
shipped in the referenced PRs._

---

## 1. Functionality audit

### Internal links — ✅ PASS

Every `href`/`<Link>` in the header, footer, mega-menu, and page bodies resolves to
a real route. No 404 risks found. Dynamic routes (`/collections/[slug]`,
`/products/[slug]`, `/journal/[slug]`, `/orders/[order]`) are wired correctly and
404 cleanly when data is missing.

### Forms & server actions — ✅ PASS (1 hardening applied)

- `/api/contact`, `/api/newsletter/subscribe`, `/api/wishlist`, checkout, account,
  gift-cards, student-discount, and careers actions all validate input, scope to the
  signed-in user, and degrade gracefully when an external service (Resend, Stripe)
  isn't configured.
- **Hardened:** the wishlist `DELETE` endpoint now includes an explicit
  `user_id` filter. It was already protected by the `wishlists_self` RLS policy
  (so not exploitable), but the explicit filter is clearer and safe under any
  future RLS change. _(Shipped in the SEO PR.)_

### Duplicate / overlapping pages — ✅ intentional

- `/login` (admin, no self-signup) vs `/account/login` (customer, self-signup) — distinct flows.
- `/about` (short intro) vs `/our-story` (long narrative) — distinct content.
- `/shipping`, `/returns`, `/shipping-returns` — some overlap; see recommendation S-7.

### TODO / placeholder — ✅ clean

No code-level `TODO`/`FIXME`. The only "coming soon" strings are intentional empty
states (empty collections, no ambassadors yet).

---

## 2. SEO audit

### Baseline (before this audit)

- Solid foundation already in place: `metadataBase`, title template, Organization +
  WebSite JSON-LD site-wide, Product JSON-LD + breadcrumbs on PDPs, per-page
  canonicals, indexing gated behind `NEXT_PUBLIC_ALLOW_INDEXING`, sitemap + robots
  that flip on at cutover.
- **Biggest gap:** only the homepage and product pages emitted their own Open
  Graph/Twitter cards — every other page silently inherited the homepage's social
  card. Titles/descriptions were brand-poetic but light on search keywords
  (swimwear / coastal clothing intent).

### Fixed in this audit (PR: _SEO pass_)

- **`pageMetadata()` helper** — every page now emits its own canonical + OG +
  Twitter card. Removes duplicated metadata boilerplate.
- **Collections** — OG card with hero image + `CollectionPage` structured data.
- **Journal posts** — OG cover image + richer `Article` JSON-LD (image, description,
  publisher) + breadcrumbs.
- **Keyword-optimised** titles + descriptions on shop, about, our-story, journal,
  sustainability, ambassadors, size-guide, student-discount, gift-cards.

### Remaining SEO recommendations

| # | Priority | Recommendation |
|---|----------|----------------|
| SEO-1 | High | **Set `NEXT_PUBLIC_ALLOW_INDEXING=true` at go-live.** The site is currently `noindex` + robots-disallow + empty sitemap. Nothing ranks until this flips. |
| SEO-2 | High | **Add a default OG share image** (1200×630) for pages without their own image (legal, contact, help). Currently those share with no image. |
| SEO-3 | Med | **Product JSON-LD: add `aggregateRating`/`review`** once reviews exist, and `availability` per-variant. Rich results love ratings. |
| SEO-4 | Med | **Collection intro copy.** Each collection page should render 2–3 sentences of indexable text above/below the grid (great for "women's swimwear" type queries). The field exists (`description`) — make sure it's populated for published collections. |
| SEO-5 | Med | **FAQ structured data** on `/help` (FAQPage schema) — you already have a FAQ accordion; marking it up wins FAQ rich results. |
| SEO-6 | Low | **Breadcrumb JSON-LD on collection + product** is present; extend to journal (done) and consider a visible breadcrumb on collections for UX + SEO. |
| SEO-7 | Low | Legal/utility pages keep generic titles — fine, but ensure they're in the sitemap only if you want them indexed (they currently are). |

---

## 3. Storefront — competitive comparison & recommendations

Benchmarked against coastal/swim/surf peers: **Finisterre, Passenger, Saltrock,
Billabong, Roxy, Vitamin A, Hunza G**, and slow-fashion DTC (**Sézane, Asket**).

### What's already strong
- Clean editorial homepage (hero collage, featured carousel, editorial banner) — on
  par with Finisterre/Passenger.
- CMS-driven content, wishlist, newsletter capture, gift cards, loyalty + referrals,
  student discount — a feature set ahead of many small DTC brands.
- Made-to-order / sustainability story — a real differentiator; lean into it.

### Recommendations (clearly prioritised)

**Tier 1 — conversion & trust (do first)**
1. **Product reviews / UGC.** No social proof on PDPs today. Add a lightweight
   reviews system (or Trustpilot/Okendo embed). Single biggest conversion lever for
   this category — every peer has it.
2. **Sticky add-to-cart on mobile PDP** + clearer size/fit guidance inline (peers
   like Hunza G/Vitamin A put fit notes right next to the variant selector).
3. **Free-shipping threshold messaging** in the header/cart ("£X away from free
   shipping") — proven AOV lift; the shipping-zones system already has the data.
4. **Trust badges near checkout** — secure payment, returns window, made-to-order
   lead time. Reduces abandonment for an unknown brand.

**Tier 2 — discovery & merchandising**
5. **"Shop the look" / outfit bundling** on PDPs and editorial — coastal brands sell
   the lifestyle; cross-sell tees+shorts+accessories.
6. **Collection filtering polish** — you have colour/size/price/sort; add "in stock"
   and fabric/feature facets as the catalogue grows.
7. **Richer collection landing copy + imagery** (ties to SEO-4).
8. **Recently viewed** + **"you may also like"** on PDP (uses existing product data).

**Tier 3 — brand & retention**
9. **Editorial → product linking.** Journal posts should deep-link to featured
   products ("shop this story"). Big for SEO + discovery.
10. **Email flows beyond transactional** — welcome series, post-purchase, win-back.
    Resend + the loyalty engine are already in place to power these.
11. **Instagram feed / UGC gallery** on homepage (you're now auto-posting — close the
    loop and pull it back onto the site).
12. **Size/fit quiz** for swimwear — reduces returns, a known pain point in swim.

---

## 4. Admin — competitive comparison & recommendations

Benchmarked against **Shopify admin, Medusa, Saleor, and Linear-style ops tooling.**

### What's already strong
- Genuinely broad: orders, products, collections + bulk tagger, CMS, blog, social
  (now with autopilot + drag-reorder), emails (editable templates), gift cards, store
  credit, financial exports (CSV/PDF), refunds, notifications, settings with audit log,
  POD integration config in-UI. This is well beyond a typical bespoke admin.
- Reserve→settle discipline for gift cards & store credit, idempotent post-payment
  hooks, service-role-only sensitive tables — solid engineering.

### Recommendations (clearly prioritised)

**Tier 1 — daily-driver ergonomics**
1. **Global search + command palette** (orders by #/email, products, customers).
   Shopify/Linear's most-used feature; biggest time-saver as volume grows.
2. **Bulk actions on lists** (orders: fulfil/refund/export selected; products:
   publish/unpublish/tag). Some exist for collections — extend across lists.
3. **Saved filters / segments** on orders & products (e.g. "awaiting fulfilment",
   "low/no images", "unpublished").
4. **Inline validation feedback** — several actions succeed/fail silently
   (server actions). Surface success/error toasts consistently (the settings page
   already has a status banner pattern to reuse).

**Tier 2 — visibility & safety**
5. **Dashboard KPIs** — today's sales, orders awaiting action, failed fulfilments,
   outstanding store-credit liability, abandoned carts. The data exists; surface it.
6. **Audit log everywhere** — settings already log; extend to refunds, store-credit
   grants, product/price edits (who changed what, when).
7. **Optimistic concurrency on edits** — warn if two staff edit the same product/order.
8. **Order timeline** — a single chronological view per order (paid → fulfilled →
   shipped → refunded, with email/webhook events).

**Tier 3 — growth tooling**
9. **Discounts/promotions manager** — currently student + newsletter codes are
   bespoke; a general code/automatic-discount engine would help campaigns.
10. **Customer view** — per-customer order history, store-credit balance, referrals,
    LTV. (Loyalty data is there; no consolidated customer screen.)
11. **Scheduled content** — blog already supports scheduling; mirror the social
    autopilot UX for blog publishing.
12. **Role granularity** — master/regular today; consider per-section permissions as
    the team grows.

---

## 5. Quick-win checklist (highest ROI, lowest effort)

- [ ] Flip `NEXT_PUBLIC_ALLOW_INDEXING=true` at go-live (SEO-1) — _blocks all ranking._
- [ ] Add a default 1200×630 OG share image (SEO-2).
- [ ] Populate collection `description` copy for published collections (SEO-4).
- [ ] Add FAQPage schema to `/help` (SEO-5).
- [ ] Free-shipping-threshold banner (Site-3).
- [ ] Admin global search / command palette (Admin-1).
- [ ] Admin dashboard KPI tiles (Admin-5).
- [ ] Product reviews on PDP (Site-1) — larger, but the top conversion lever.
