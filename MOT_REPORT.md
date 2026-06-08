# Nautical Nomads — Full Site MOT / Audit

**Date:** 2026-06-08 · **Commit audited:** `main` @ `3e388bc` · **Stack:** Next.js 15 (App Router) · OpenNext → Cloudflare Workers · Supabase (Postgres/Auth/Storage) · Stripe · Resend · POD (Printful + Printify)

Method: four parallel read-only deep audits (storefront/SEO/a11y · commerce/payments/fulfilment · admin/auth/security · config/infra), cross-checked against the brief (`REDESIGN.md`, `RUNBOOK.md`, `PROGRESS.md`) and hand-verified on the highest-impact items.

---

## A. Executive summary

**Overall: architecturally solid, well-layered, and close to launch — but not launch-ready yet.** The codebase is consistently structured, role-gated, RLS-enforced, and degrades gracefully almost everywhere. The blockers are a small, fixable set of (1) security defaults that **fail open**, (2) **money-trust** issues in checkout/refunds, and (3) Workers-runtime reliability gaps.

What's genuinely good (verified, no action needed):
- Service-role Supabase client is never imported into client code; admin pages + actions all call role guards; RLS denies anon on every sensitive table.
- Customer↔admin privilege separation holds at the DB policy layer (a customer cannot become an admin).
- The Stripe-on-Workers fixes from this session (fetch HTTP client + async SubtleCrypto webhook verify + session-verify fallback) are correct and deployed.
- No dynamic `process.env[x]` access anywhere (the Workers footgun is avoided).
- Indexing is correctly opt-in (`NEXT_PUBLIC_ALLOW_INDEXING` defaults off).

**Top launch blockers:** webhook/cron fail-open (§C-1), client-trusted prices (§C-2), refund reconciliation correctness (§C-3), paid-order side-effects durability (§C-4). Everything else is polish or post-launch.

---

## B. What's built vs. the brief

Mapped against the `RUNBOOK.md` pre-launch checklist (the de-facto acceptance criteria) and `REDESIGN.md` phases.

Legend: ✅ done · 🟡 partial / needs verification · ⚠️ built but has a bug/risk (see §C) · ⬜ missing

### Storefront & content
| Item | Status | Notes |
|---|---|---|
| Home, /shop, /collections, /products, static pages render | ✅ | All routes build & SSR with guarded fetches |
| Dynamic mega-menu from published collections | ✅ | `lib/nav-data.ts`, cached tag `nav` |
| Homepage CMS (hero/carousel/banner/tiles/strip) | ✅ | `/admin/content` |
| PLP + product card + client filters + NEW badge | ✅ | |
| Wishlist (guest localStorage + merge) | ✅ | `wishlists` table + API (REDESIGN listed it ⬜; later built) |
| Newsletter (Resend + Supabase) | ✅ | |
| Static/legal pages (shipping, returns, privacy, terms, cookies…) | ✅ | ⚠️ duplicate shipping/returns pages (SEO, §D) |
| 404 branded page | ✅ | |
| Lighthouse perf/a11y pass | 🟡 | Never run in-browser; a11y gaps found (§C-9) |
| Image alt text on products | 🟡 | Auto alt-text exists; not audited across catalogue |

### Cart, checkout, payments
| Item | Status | Notes |
|---|---|---|
| Add-to-bag, mini-cart, /cart qty/remove/subtotal | ✅ | |
| /checkout collects email+address, Stripe redirect | ✅ | Fixed this session (was crashing) |
| Order created `pending` → webhook flips `paid` | ⚠️ | Works, but webhook + side-effects have durability/idempotency gaps (§C-3,4) |
| Order confirmation email | 🟡 | Sends from webhook/fallback; **requires `RESEND_API_KEY` + webhook configured** |
| Live-mode purchase end-to-end | ⬜ | Still test mode; not yet run live |
| Server-side price validation | ⚠️ | **Trusts client cart prices/currency** (§C-2) |

### Shipping, orders, fulfilment
| Item | Status | Notes |
|---|---|---|
| Live POD quotes (Printful + Printify) + flat fallback | ✅ | |
| Admin shipping mode toggle + flat zones | ✅ | |
| /admin/orders + detail + retry + manual fallback | ✅ | |
| Auto-fulfilment + kill-switch + dry-run | ✅ | `fulfilment_dry_run` still ON (safe) |
| Tracking webhook → order + shipping email | ⚠️ | Works but **fails open** when secret unset (§C-1); address used is client-form not Stripe-collected (§D) |

### Refunds, roles, financial
| Item | Status | Notes |
|---|---|---|
| Customer refund request (guest + account) | ✅ | Account path RLS-scoped; guest path is UUID-bearer (§D) |
| Admin Stripe refund issue | ⚠️ | No idempotency key → double-issue risk (§C-3) |
| Refund webhook reconciliation | ⚠️ | `charge.refunded` reads un-expanded list; matches wrong row (§C-3) |
| Roles enforced server-side (master/regular/content) | ✅ | |
| Invite / set role / deactivate | ⚠️ | No "last master" lockout guard (§D) |
| Financial dashboard + CSV + PDF + disclaimer | ✅ | ⚠️ cross-currency sum (§D) |

### Email, social, blog, SEO
| Item | Status | Notes |
|---|---|---|
| Email journeys (order/ship/refund/welcome/abandoned/owner) | ✅ | + **editable templates** added this session |
| Abandoned-cart cron | ⚠️ | Wired, but **fails open** without `CRON_SECRET` (§C-1) |
| Owner alerts (fulfilment_failed/refund/dispute) | ✅ | |
| Google Drive listing + caption gen | ⚠️ | **Drive JWT signing uses node:crypto → throws on Workers** (§C-7) |
| Make.com webhook publish | ⬜ | Env documented but **no consumer in code** (descoped?) |
| Blog auto-queue (new + on-sale) + manual URL draft | ✅ | |
| Journal renders + markdown | ✅ | |
| sitemap.xml / robots.txt (indexing-gated) | ✅ | sitemap missing some legal pages (§D) |
| Product/Org/Breadcrumb JSON-LD | ⚠️ | Product LD can emit `NaN`/invalid offers (§C-8) |
| OG / Twitter cards | ⚠️ | **No default OG image, no favicon** (§C-8) |

---

## C. Issues — by severity (consolidated & de-duplicated)

### 🔴 Critical / launch-blocking

**C-1 — Webhooks & cron FAIL OPEN when their secret is unset.**
`app/api/webhooks/printful/route.ts:15`, `app/api/webhooks/printify/route.ts:15`, `app/api/cron/abandoned-cart/route.ts:15` all use `if (secret && provided !== secret) …`. When the secret/env is blank (the **default** state on a fresh deploy), the auth check is skipped and the endpoint processes anonymous requests — letting anyone forge "shipped/delivered" events (triggering customer emails + status changes) or hammer the cron to send mail. `worker.js:15` also passes `CRON_SECRET ?? ""`.
**Fix:** fail closed — `if (!secret || provided !== secret) return 401`. Use a timing-safe compare. Make `CRON_SECRET`, `PRINTFUL_WEBHOOK_SECRET`, `PRINTIFY_WEBHOOK_SECRET` required for launch.

**C-2 — Checkout trusts client-supplied prices & currency (price-tampering + wrong totals).**
`app/checkout/actions.ts:26,56,99-101,117`. `subtotal`, `grand_total`, stored `order_items.unit_price`, and the Stripe `unit_amount` all come from the client `CartItem.price`; `currency` is taken from `items[0]` only. A tampered client can set arbitrary prices; a mixed-currency cart silently mis-totals. The variant query at line 32 already round-trips the DB but fetches only provider IDs, not the authoritative price.
**Fix:** select `variants.price`/`products.price` in that same query; compute all money server-side; reject carts that aren't a single currency. Treat client `price` as display-only.

**C-3 — Stripe refund reconciliation is incorrect (refunds may never complete, or complete the wrong row/amount).**
`app/api/webhooks/stripe/route.ts:75` reads `charge.refunds?.data`, which modern Stripe does **not** expand inline in `charge.refunded` events → loop often no-ops, order never flips to `refunded`. Lines 80-101 then pick the **oldest open** local refund by `created_at` with **no match on `stripe_refund_id` or amount** → with partials/multiple refunds, a £10 Stripe refund can complete a £50 local row and email the wrong amount. Admin issue path (`app/admin/refunds/actions.ts:47`) has **no Stripe idempotency key** → double-click/retry can double-refund.
**Fix:** drive reconciliation off `refund.updated` (already handled) or `stripe.refunds.list({charge})`; match by `stripe_refund_id` then amount; add `{ idempotencyKey: refund.id }` to `refunds.create`; make both event paths no-op when the row is already `completed`.

**C-4 — Paid-order side-effects are fire-and-forget on Workers (emails/fulfilment can be dropped).**
`lib/orders.ts:32-33` — `sendOrderConfirmation()` and `autoFulfilOrder()` are not awaited; `markOrderPaid` returns immediately and the webhook responds, after which the isolate may be torn down before they finish. Compounded by `lib/fulfilment.ts` sleeping up to ~7s per provider (sequential) inside the request, risking the Workers time limit.
**Fix:** `await` the side-effects in the webhook path (or thread `ctx.waitUntil`), and move POD fulfilment/retries off the request path (queue or cron re-drive). Guard order status transitions so a late `autoFulfilOrder` can't stomp `shipped`→`fulfilling` (`lib/fulfilment.ts:139-166`).

### 🟠 High

**C-5 — Hardcoded Supabase URL + anon JWT + Stripe publishable key committed as fallbacks.** `next.config.mjs:14-21`. If Worker env is ever unset the app silently uses these; they're in git history. **Fix:** empty/placeholder fallbacks, require real env, rotate the committed anon key.

**C-6 — `email_templates` table has no migration file.** Created only as a copy-paste snippet in the admin UI (`app/admin/emails/page.tsx`). Reads fall back to code defaults (fine), but **saving** an override throws until the owner runs the SQL. *(This was introduced this session — should ship as a real migration.)* **Fix:** add `supabase/migrations/…_email_templates.sql`.

**C-7 — Google Drive feature throws on Workers.** `lib/google-drive.ts:39-42` signs the service-account JWT with Node's `crypto.createSign("RSA-SHA256")`, unavailable on `workerd`. The social Drive-image listing/caption feature errors at runtime. **Fix:** re-implement signing with `crypto.subtle` (RSASSA-PKCS1-v1_5/SHA-256), mirroring the Stripe SubtleCrypto path; replace `Buffer` base64url with `btoa`/`Uint8Array`.

**C-8 — SEO/share gaps: no default OG image, no favicon; Product JSON-LD can be invalid.**
No `opengraph-image.*`, `icon.*`, or `favicon.*` in `app/` → shared links are imageless and the site has no favicon (`app/layout.tsx:26-37`). `lib/structured-data.ts:41-71` (`productLd`) yields `NaN` prices for null-price/variant-less products and emits `sku: undefined`, which can invalidate the Product rich result.
**Fix:** add `app/opengraph-image.tsx` + `app/icon.png`/`favicon.ico` and default `openGraph.images`/`twitter.images`; in `productLd`, omit the `offers` block when there's no valid numeric price and only include `sku` when present.

**C-9 — Accessibility: core nav & add-to-cart are mouse-only; no skip link.**
Mega-menu opens on `onMouseEnter` only (`components/Header.tsx:170-185`) — keyboard users can't reach sub-links; quick-add panel is `group-hover` only (`components/ProductCard.tsx:101-129`); no skip-to-content link (`app/layout.tsx:51`). **Fix:** add `onFocus`/`onBlur` (or click-toggle) to the menu, make quick-add focus-visible, add a visually-hidden skip link to `<main id="main">`.

**C-10 — Effective no caching: every page hits Supabase live.** Root layout reads cookies via `getCustomer()` (`app/layout.tsx:41`) → whole tree is request-dynamic, so the `revalidate=300` on home/shop/product does nothing; and the Footer does an **uncached** CMS read on every render (`components/Footer.tsx:97`, `lib/cms.ts:12`). **Fix:** wrap `getCmsValue` in `unstable_cache`(tag `cms`); isolate the cookie/personalised read so the marketing shell can be static (or accept SSR but add explicit cache tags).

### 🟡 Medium

- **C-11 — Product page can 500 instead of 404 on Workers.** `app/products/[slug]/page.tsx` uses `generateStaticParams`+ISR but didn't get the `force-dynamic` treatment that `app/collections/[slug]/page.tsx:16` documents as the fix for Workers-adapter 500s on un-prerendered slugs. **Fix:** apply the same pattern.
- **C-12 — Fulfilment ships to the client-form address, not the Stripe-collected one.** `app/checkout/actions.ts` stores the form address; Stripe `shipping_address_collection` lets the buyer change it. **Fix:** overwrite `orders.shipping_address` from the session's shipping details on `checkout.session.completed` before fulfilling.
- **C-13 — Nav can be stale up to 5 min after publishing a product.** Visibility depends on a collection having ≥1 published product, but `app/admin/products/actions.ts` never calls `revalidateTag("nav")`. **Fix:** add it to product publish/unpublish/status changes.
- **C-14 — `PRINTFUL_STORE_ID` read but undocumented** in `.env.example`; multi-store Printful accounts get confusing quote/fulfilment failures. **Fix:** document it.
- **C-15 — User management self-lockout.** `app/admin/users/actions.ts` lets a master demote/deactivate the last master, and `role` isn't allow-list validated. **Fix:** block last-master demotion/deactivation; validate role ∈ {master,regular,content}.
- **C-16 — POD webhook secret rendered as plaintext** in `/admin/settings` HTML (`page.tsx:17-21,181`). Ops-only, but should be reveal-on-click like the API-key fields. 
- **C-17 — Guest order page / refund action**: reads any order by UUID via the service client and renders the email; `requestRefund` is unauthenticated + unthrottled (an order/email confirmation oracle). UUIDs bound the risk. **Fix:** prefer the authed path, rate-limit, reduce email exposure.
- **C-18 — Duplicate shipping/returns pages** (`/shipping-returns`, `/shipping`, `/returns`) = duplicate-content SEO dilution. **Fix:** one canonical + 301 the others (redirect infra already exists).
- **C-19 — Sitemap omits indexable legal/info pages** (`app/sitemap.ts:16-24`): sustainability, privacy, cookies, terms, shipping, returns, etc. **Fix:** add them.
- **C-20 — `quoteShipping` module-scope cache is unbounded + cross-request** on a warm isolate (`lib/shipping.ts:140`) → can serve a stale quote and grow forever. **Fix:** request-scope it or add TTL+cap.

### 🟢 Low / Nits
- Financial summary sums Stripe balance transactions across currencies into one number (`lib/financial.ts`) — latent bug for any non-GBP sale; group by currency.
- Mega-menu uses raw `<img>` (`components/Header.tsx:230`) — use `next/image`.
- Abandoned-cart marker is stashed inside `shipping_quote` JSON — prefer a dedicated column.
- `/api/health` reports `schema:"migrated"` after probing only `products` — misleading.
- Wishlist heart always uses `variants[0]` regardless of selected size.
- `JsonLd` doesn't escape `<` in stringified data (app-controlled today; escape `<`→`<` for safety).
- Sitemap entries omit `lastModified`; `robots.host` is non-standard/dead.
- Non-constant-time token compares in webhooks.

> Two findings raised by the automated pass were **rejected after verification**: `runtime="nodejs"` on the Stripe webhook is correct for OpenNext (not a bug), and `ANTHROPIC_MODEL=claude-sonnet-4-6` is a valid current model id.

---

## D. Improvements & recommendations (beyond bugfixes)

- **Observability:** no error monitoring/analytics. Add Sentry (or Cloudflare Workers logs + a logpush) and a privacy-friendly analytics tag; wire an uptime check on `/api/health`. This also closes out the recurring "Digest" homepage-error mystery from earlier.
- **Durable fulfilment:** move POD order placement to a Cloudflare Queue / cron re-drive so payment confirmation never depends on in-request retries (ties into C-4).
- **Partial refunds:** model partial/over-refund and clamp the refund amount to the PI's captured amount (shipping often non-recoverable on POD).
- **Migrations runbook:** produce an authoritative "apply these N migrations in order" checklist and verify all are applied; the `select("*")`/try-catch guards currently *hide* "owner forgot the SQL" as silent empty states (e.g. nav vanishing).
- **Performance:** once C-10 is resolved, statically render the marketing shell; use `estimated` counts on /shop; lazy-load below-the-fold imagery.
- **Bump `wrangler` `compatibility_date`** (currently 2025-03-01) for better `nodejs_compat` coverage (helps C-7), and test.
- **Clean `.env.example`:** add `PRINTFUL_STORE_ID`, document `SHOPIFY_ADMIN_TOKEN`, remove the unused `MAKE_WEBHOOK_URL` (or implement its consumer).
- **Run Lighthouse + a Rich-Results test** in-browser on the branch preview before cutover (can't run headless here).

---

## E. Pending owner actions (the launch checklist)

**Secrets to set in Cloudflare (required):** `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live endpoint), `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `PRINTFUL_API_KEY` + `PRINTFUL_STORE_ID` (17467626) + `PRINTFUL_WEBHOOK_SECRET`, `PRINTIFY_API_KEY`/`PRINTIFY_SHOP_ID`/`PRINTIFY_WEBHOOK_SECRET`.
**Stripe:** register the live webhook endpoint; confirm an order flips to `paid` end-to-end.
**Migrations to run in Supabase:** confirm all 11+ migrations applied; **run the new `email_templates` SQL** (shown in /admin/emails) — and ship it as a migration (C-6).
**Rotate** the Anthropic key that appeared in chat earlier; rotate the committed Supabase anon key (C-5).
**Content:** upload hero/tile/banner images in /admin/content and category cover photos.
**Cutover:** flip `NEXT_PUBLIC_ALLOW_INDEXING=true`, re-deploy, DNS swap, verify, then decommission Shopify (per `RUNBOOK.md §2`).

---

## F. Recommended fix order

1. **Security defaults — fail closed** (C-1) + require the launch secrets. *(small, high impact)*
2. **Money trust** — server-side prices + single-currency guard (C-2); refund reconciliation + idempotency key (C-3).
3. **Durability** — await/`waitUntil` paid-order side-effects; move fulfilment off the request path (C-4).
4. **Ship `email_templates` migration** (C-6) and the migrations-applied checklist.
5. **SEO/brand quick wins** — default OG image + favicon, `productLd` guard (C-8); sitemap + dup-page cleanup (C-18/19).
6. **A11y** — skip link + keyboard nav/quick-add (C-9).
7. **Perf** — cache the Footer CMS read + static shell (C-10); product-page `force-dynamic` (C-11); `revalidateTag("nav")` on publish (C-13).
8. **Workers fix** for Google Drive signing (C-7); rotate committed creds (C-5).
9. Mediums/lows as capacity allows.

None of these require re-architecting; the foundations are sound. The critical four (C-1–C-4) are the real gate to a safe live launch.
