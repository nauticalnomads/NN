# PROGRESS

Running log of what's built, decisions made, and TODOs. Update at the end of every session.

---

## Session 01 — Project Scaffold ✅ (code complete; owner actions pending)

A deployable, empty-but-styled Next.js app wired for Cloudflare + Supabase, with the
Nautical Nomads design tokens in place.

### Built

- **Next.js 15 (App Router, TypeScript)** scaffolded by hand for precise control.
- **Cloudflare adapter:** `@opennextjs/cloudflare` (OpenNext) — the current GA adapter, replaces
  the maintenance-mode `next-on-pages`. Config in `open-next.config.ts` + `wrangler.jsonc`
  (`nodejs_compat`, assets binding). `next dev` gets CF bindings via `initOpenNextCloudflareForDev()`.
- **Tailwind CSS v4** (CSS-first `@theme` in `app/globals.css`). Design tokens as CSS variables
  with `[data-theme]` scoping so palettes swap without touching layout.
  - **Horizon** palette — exact brand-bible §9.2 hexes.
  - **Tempest** + **Lagoon** — defined as alternate toggleable palettes (see ⚠️ below).
  - Type scale tokens: Display 1 → Caption.
- **Fonts** via `next/font/google` (`lib/fonts.ts`): Montserrat (display), DM Sans (body),
  JetBrains Mono (mono). Self-hosted at build time — no runtime FOUT, good for Core Web Vitals.
- **Base layout** (`app/layout.tsx`): Header (logo placeholder + nav), Footer, `Container`.
  Default metadata + title template. 60/30/10 surface/ink/accent applied.
- **`/styleguide`** — living reference: all three palettes (scoped swatches) + a live theme
  switcher, full type scale, buttons, font specimens.
- **Home page** — editorial "Live by the tide" hero in brand voice.
- **Supabase client** (`lib/supabase/`): `client.ts` (browser, anon), `server.ts` (cookie-bound
  server client + a service-role client for trusted server contexts only).
- **`/api/health`** — trivial server-side Supabase ping (Session 01 done-criterion). Returns a
  graceful 503 `unconfigured` until env vars are set.
- **ESLint (flat config) + Prettier** + **CI** (`.github/workflows/ci.yml`):
  format check → lint → typecheck → build on every push/PR.
- **`.env.example`** documents every secret (current + a checklist for later sessions).
- **`scripts/resend-smoke-test.mjs`** — one-shot send to prove the verified domain delivers.

### Verified in this environment

- `npm run typecheck` — clean.
- `npm run lint` — no warnings/errors.
- `npm run format:check` — clean.
- `npm run build` — succeeds (fonts download, 6 routes, SSG + the dynamic health route).
- `next start` smoke test: `/` renders the hero, `/styleguide` renders all three palettes +
  type scale + fonts, `/api/health` returns the expected unconfigured response, `/x` → 404.

### Decisions

- **Adapter = OpenNext (`@opennextjs/cloudflare`), not `next-on-pages`.** OpenNext supports the
  Node.js runtime (so the server Supabase client and future Stripe/webhook routes work without
  forcing `export const runtime = "edge"` everywhere). `next-on-pages` is in maintenance mode.
- **Tailwind v4 CSS-first tokens.** No `tailwind.config.ts`; tokens live in `globals.css` `@theme`.
  Swatches in the styleguide use inline `var(--token)` styles because v4's JIT can't see
  dynamically-built class names (`bg-${token}`).
- **Service-role Supabase client is in `lib/supabase/server.ts`** but must never be imported into
  client code. It bypasses RLS — reserved for migrations/webhooks.

### ⚠️ Needs owner sign-off

- **Tempest & Lagoon palette hexes are PLACEHOLDERS.** The brand bible (§9.2) only specifies
  Horizon. I invented coherent alternates (Tempest = cooler/stormier, Lagoon = brighter coastal)
  so the toggle works end-to-end, but the exact values should be confirmed against brand artwork.
  They're labelled "proposed, pending sign-off" in `/styleguide`.
- **Logo is a text placeholder.** The hand-painted "N" monogram is artwork (never typeset). Drop
  the real asset into `components/Logo.tsx` when available.

### TODO — owner actions (cannot be done from Claude Code Web)

These are infrastructure steps that require your accounts/credentials:

1. **Cloudflare deploy.** Repo is connected to Cloudflare Workers Builds. `npm run build` now runs
   the **OpenNext** build (`opennextjs-cloudflare build`) so it emits `.open-next/worker.js` for
   `wrangler deploy` — keep the project's Build command as `npm run build` and Deploy as
   `npx wrangler deploy`. Confirm the live URL renders `/styleguide`. _(Needs your Cloudflare account.)_
2. **Supabase env vars.** Create/confirm the Supabase project, then set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare (and `.env.local`
   for dev). Hit `/api/health` — it should return `{ ok: true }`.
3. **Resend domain verification.** Add SPF, DKIM, DMARC records for the sending subdomain
   (e.g. `mail.nauticalnomads.com`) in Cloudflare DNS; verify the domain in Resend. Then run
   `npm run email:smoke` and confirm the test email lands in the inbox (not spam).
4. **Secrets stay out of the repo** — set them in Cloudflare/Supabase only.

---

## Session 02 — Database Schema & Supabase Setup ✅ (code complete; you run the SQL)

A complete, migration-versioned schema with RLS, indexes, typed clients, and seeded settings.

### Built

- **Versioned migrations** in `/supabase/migrations` (no dashboard edits):
  - `…120000_init.sql` — `pgcrypto`, 11 enums, the `set_updated_at()` trigger, all **16 tables**
    (§4), POD mapping fields (`provider`/`provider_product_id`/`provider_variant_id`/`base_cost`)
    on products + variants, an **immutable `order_items` snapshot**, `fulfilment_attempts`
    (with unique `idempotency_key`) and `notifications`, plus indexes on slugs/status/created_at/
    provider IDs.
  - `…120001_rls.sql` — `SECURITY DEFINER` role helpers (`current_user_role`, `is_master`,
    `is_ops`, `is_staff`) and RLS on every table enforcing the §3 matrix.
  - `…120002_seed.sql` — singleton `store_settings` (VAT **off**, live shipping, auto-fulfilment
    **on**, `fulfilment_dry_run` **on**, brand voice seeded with §9.3 + 6 example captions + 3
    example product descriptions) and `shipping_settings` (UK/EU/RoW flat zones).
- `supabase/seed_master_admin.sql` — promote the owner to `master` (run after they sign up).
- **TS types** `lib/database.types.ts` (Row/Insert/Update + enums) wired into all Supabase clients.
- `/api/health` now does an anon-readable `products` count → confirms connectivity **and** that
  the schema is migrated.

### Verified (against a throwaway local Postgres 16)

- All migrations **apply cleanly from scratch**; 16 tables, 16 RLS-enabled, 29 policies, seed loads.
- RLS behaves: **anon** sees only `published` products and **cannot** read `store_settings`;
  **customer A** sees only their own order; **customer B** sees 0 (no cross-customer leakage).

### Decisions

- **Money** = `numeric(12,2)` + `currency` (default `GBP`); `tax_total` defaults 0 (VAT off).
- **Settings are ops-only** under RLS. The storefront/checkout read settings **server-side via the
  service client**, not anon — keeps `make_webhook_url`/`social_config` out of public reach.
- **`compare_at_price`** on products powers on-sale detection (blog auto-queue, Session 13).
- **`fulfilment_dry_run`** defaults **on** so no real POD orders are ever placed until explicitly
  turned off in production (Session 07 safety rail).

### ⚠️ You need to run the SQL

The migrations are not auto-applied (no DB credentials in the web sandbox). Run the consolidated
SQL I provided in chat against your Supabase project (SQL Editor), then run `seed_master_admin.sql`
with your email after you've signed up. After that, `/api/health` should report
`{ ok: true, schema: "migrated" }`.

---

## Session 04 — Storefront ✅ (code complete; fills in once products exist)

A fast, SEO-maximised, brand-accurate storefront reading live from Supabase, with graceful
empty-states until the Session 03 migration lands.

### Built

- **Home** — editorial hero, collections strip, featured grid (reads `getFeaturedProducts`).
- **Shop** `/shop` — product grid with sort (featured/newest/price) + pagination.
- **Product** `/products/[slug]` — gallery, **functional variant selector** (size/colour → live
  price + SKU), brand-voice description, `generateStaticParams` + `generateMetadata`.
- **Collections** `/collections/[slug]` — grid + per-collection SEO.
- **Static** — About, Contact, Shipping & Returns (**import VAT/duty note** for international),
  Size guide, and a styled **404** ("You drifted off the chart").
- **SEO (§5)** — env-driven `metadataBase`/canonicals, OG + Twitter tags, editable SEO
  title/description per product & collection, **JSON-LD** (Organization site-wide, Product +
  BreadcrumbList on PDP, Breadcrumb on collections), `sitemap.xml`, `robots.txt`, image alt text
  with title fallback.
- `next/image` configured for Supabase Storage + Printful/Printify/Shopify CDNs.
- Shared libs: `lib/site.ts`, `lib/queries.ts` (resilient — empty/null on any failure),
  `lib/format.ts`, `lib/structured-data.ts`.

### Verified (local `next build` + `next start`, no Supabase env = empty-state path)

- 13 routes build; static pages 200; unknown product/collection → **404**; `sitemap.xml` +
  `robots.txt` serve; home shows hero + empty-catalogue message; import-VAT note present.
- typecheck / lint / format all clean.

### Decisions / notes

- **Add-to-bag is intentionally disabled** on the PDP — variant selection is fully functional, but
  cart + checkout are Session 05. Labelled "coming soon" so it's honest, not broken.
- **Domain via `NEXT_PUBLIC_SITE_URL`** (defaults to `https://nautical-nomads.com`). Set this in
  Cloudflare now; the later `nauticalnomads.com` cutover is then a one-line env change.
- Storefront reads through the anon client + RLS (published-only). Couldn't test against your live
  Supabase from the sandbox (no egress); empty-state path verified instead.

### ⚠️ Owner action

- Set **`NEXT_PUBLIC_SITE_URL`** in Cloudflare (and locally) so canonicals/sitemap/OG use the right
  host.

---

## Sessions 03, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14 — built between PROGRESS.md updates

(PROGRESS.md was stale through these — closing the gap now. Full session-by-session detail in
the commit messages: `486ffbc` (Session 03), `0ebbb7b` (08), `6f839c6` (05), `1baf80c` (06+07+
09+10+11+12+13+14). Audit at `docs/audit-2026-05.md` (or chat transcript) catalogues remaining
gaps and prioritised fixes.)

**Highlights:**

- Session 03 — Shopify migration script rewritten with empirically-derived provider mapping
  (Printful sync-products + SKU-pattern fallback, Printify external.id, JetPrint vendor +
  best-guess API). Dry-run on real catalogue: 273 clean / 4 flagged (compare_at_price reversed)
  / 0 unmapped across 277 products.
- Session 05 — Cart, Stripe Checkout (hosted), webhook with idempotent paid-flip, immutable
  `order_items` snapshot including `provider`/`provider_product_id`/`provider_variant_id`,
  /orders/[id] confirmation page.
- Session 06 — Printful live shipping working; Printify shipping currently stubs to null and
  falls through to flat-zone fallback (called out in audit as launch-blocker #3).
- Session 07 — Auto-fulfilment with kill-switch + dry-run; Printful + Printify order placement,
  webhook listeners for tracking. JetPrint placement is a `MANUAL-…` placeholder (audit #2).
- Session 08 — Magic-link auth, role guards (master/regular/content) enforced server-side
  on every `/admin/**` route and action. Verified by grep + smoke test.
- Session 09 — Financial dashboard with date-range, Stripe balance-transactions, COGS from
  local snapshots, CSV export. **PDF export missing** (audit #13).
- Session 10 — Refunds: customer request from `/orders/[id]`, admin Stripe-API issue from
  `/admin/refunds`. Stripe `charge.refunded`/`refund.updated` handlers currently no-op (#8).
- Session 11 — Resend templates (order confirm, shipping auto-from-POD-webhook, refund,
  welcome, abandoned-cart, owner alert). **Welcome + owner-alert + abandoned-cart cron all
  not wired to triggers** (audit #4, #5, #15).
- Session 12 — Drive-listing service-account, Anthropic vision captioning, Make.com webhook.
  **Scheduling missing** (#19), **no admin UI for `make_webhook_url`** (#16).
- Session 13 — Manual URL-paste draft works. **Auto-queue triggers dead code** (#12), markdown
  not rendered (#17).
- Session 14 — RUNBOOK.md with pre-launch checklist, cutover, ops, kill-switches.

---

## Session 03b — Migration FIRST REAL RUN

Discovered two schema/code mismatches that the dry-run didn't surface (dry-run never writes):

1. `migrate-shopify.mjs` was inserting `provider` on variant rows. `variants` table has no
   such column — provider lives on products. First run wrote 99 products, then variants
   insert error rolled back every subsequent operation (variants, images). Result: 99 orphan
   products, 0 variants, 0 image rows.
2. `app/checkout/actions.ts` was reading `provider` from variants (same bug) and **omitting
   `provider`/`provider_product_id`/`provider_variant_id` from the `order_items` snapshot**.
   Means checkout would have crashed at enrichment, and even if it hadn't, fulfilment had
   nothing to dispatch from. Latent — would have hit on first real purchase.

Both fixed. Migration restarted. Idempotent on `(source, source_id)` so orphans get updated
in place rather than duplicated. Real-run report to be appended once complete.

---

## Session 03d — Scope reduction: drop JetPrint entirely

Owner decision after the audit: the 9 JetPrint watches won't appear on the new
site. Auto-fulfilment scope is now Printful + Printify only (both with real,
working APIs).

Removed:

- 9 JetPrint product rows + their variants/images + storage folders (deleted live).
- `jetprint` value from the `pod_provider` enum (migration
  `20260528000000_drop_jetprint_provider.sql`, idempotent + safety-checked).
- `buildJetprintMap()` from `scripts/lib/providers.mjs`.
- JetPrint detection cases from `detectMapping()` in the migration script.
- JetPrint case from `lib/fulfilment.ts` (the `MANUAL-…` placeholder).
- `jetprint` from the `provider` union in `lib/shipping.ts`, `lib/fulfilment.ts`,
  `lib/database.types.ts`.
- `JETPRINT_*` env vars from `.env.local` (and never added to `.env.example`).
- RUNBOOK mentions.
- Audit launch-blocker #2 (JetPrint) is now closed by removal.

Added:

- Source filter in the migration loop — vendor matching `jetprint` is skipped
  before normalisation runs, so the data never touches the DB.
- Validation simplified (no jetprint special-case).
- Report counts include a "Skipped (JetPrint at source)" total for transparency.

---

## Step 1 — Migration COMPLETE ✅

Final result against live Supabase:

```
Clean: 268 · Flagged: 0 · Total: 268
By provider — printful=234, printify=34, unmapped=0
Skipped (JetPrint at source): 9
DB: 268 products · 1,155 variants · 2,360 image rows
```

Run notes:

- First round flagged 3 transient Supabase REST failures (`upsert failed`).
  Fixed by wrapping `upsertProduct()` in retry; second round completed all 268
  cleanly with zero flags.
- TLS cert-rotation issues on Shopify/Printful/Printify were resolved by the
  per-call retry helper (`scripts/lib/retry.mjs`) + outer supervisor
  (`scripts/migrate-supervisor.sh`) — both committed.
- PDP 500 fix: switched storefront reads to a cookies-free anon client
  (`lib/supabase/public.ts`). `generateStaticParams` now works without the
  "page changed from static to dynamic" conflict.

Storefront verified end-to-end against real data:

- `/` 200 · `/shop` 200 · `/sitemap.xml` 200 · `/admin` 307 (gate)
- `/products/<real-slug>` 200, renders title + £-formatted price + Shopify CDN image
- Build succeeds, all 268 product pages + 0 collections SSG'd with 5 min ISR

### Updated launch-blocker order from audit

1. ✅ Migration complete (Step 1)
2. ~~JetPrint integration~~ (closed by removal)
3. ✅ Printify live shipping
4. ✅ Admin shipping-zone editor + Make.com webhook field
5. ✅ Owner-alert wiring + `/admin/notifications` inbox
6. ✅ `/admin/orders/[id]` detail + manual-fallback view + retry button
7. ✅ Retry-with-backoff for transient POD failures
8. ✅ Stripe `charge.refunded` / `refund.updated` reconciliation

---

## Step 8 — Stripe refund webhook reconciliation ✅

Replaced the two no-op cases in `app/api/webhooks/stripe/route.ts`.

### `charge.refunded`

Triggered when any refund succeeds on a charge. Logic:

1. Find our order by `stripe_payment_intent_id`.
2. For each `succeeded` Stripe refund on the charge, look for an open (not
   `completed`/`rejected`) local `refunds` row for that order.
3. **If found:** mark it `completed`, record `stripe_refund_id`, flip order to `refunded`,
   send customer refund email (fire-and-forget).
4. **If not found** (refund was issued directly in the Stripe dashboard): insert a new
   reconciliation `refunds` row (`status=completed`) so it's visible in the admin.
   Flip order to `refunded`.

- Idempotent: already-completed rows are never touched (`.not("status", "in", …)`).

### `refund.updated`

Triggered on Stripe refund status changes (pending → succeeded, failed, canceled).
Logic:

1. Look up local `refunds` row by `stripe_refund_id`.
2. Map Stripe status → our enum (`succeeded→completed`, `failed→failed`, `canceled→rejected`,
   `pending/requires_action→processing`).
3. Don't downgrade an already-`completed` or `rejected` row (idempotent).
4. On `completed`: flip order to `refunded` + send customer email.

### Verified

- `tsc --noEmit` clean.
- `prettier --check .` clean.
- No live Stripe test yet — gated on the end-to-end test purchase (all 8 steps now done).

## Step 7 — Retry-with-backoff for transient POD failures ✅

### Built

Added to `lib/fulfilment.ts`:

- **`MAX_RETRIES = 3`** (1 initial attempt + up to 2 retries; total max 4 POD calls per
  provider per order). **Backoff: 1s → 2s → 4s.** Max possible sleep is 7s — well inside the
  Cloudflare Workers ~30s limit.
- **`isTransient(err)`** — classifies errors: 5xx + 429 HTTP status codes are transient
  (retry); 4xx (bad address, variant not found, validation) are permanent (fail immediately,
  no point retrying). Network/fetch errors (TypeError, AbortError) are treated as transient.
  Detection is based on the throw format already used by `placePrintful` / `placePrintify`
  (`"Printful 5xx: …"` / `"Printify 5xx: …"`).
- Retry loop wraps the provider call; on transient error at attempt < MAX_RETRIES → sleeps
  and retries. On permanent error or after exhausting retries → breaks and records the failure.
- A `fulfilment_attempts` row is still recorded once per provider (after the loop), not per
  retry attempt — the log stays clean. The error detail on a retried-then-failed row includes
  the final error message.
- `dry_run` mode bypasses the loop entirely (synthetic result as before).

### Verified

- `tsc --noEmit` clean.
- `prettier --check .` clean.

## Step 6 — `/admin/orders/[id]` detail page ✅

### Built

- **`app/admin/orders/[id]/page.tsx`** — full order detail: customer + shipping address, line
  items table (title/variant/SKU/provider IDs/qty/price), order totals, tracking entries,
  provider orders summary, full `fulfilment_attempts` history with timestamps/status/errors.
  - Attention banner (amber) when `fulfilment_failed` or `awaiting_fulfilment`.
  - Status badge with colour coding.
  - Uses `createServiceClient` (ops only, `requireOps`).
- **Manual-fallback section** (shown only when attention needed): per-provider collapsible form
  to paste a provider order reference + optional tracking number. Saves a `fulfilment_attempts`
  row (status=success, `::manual` idempotency key suffix) and updates order status to
  `fulfilling`. Appends tracking to `orders.tracking` array if provided.
- **"Retry auto-fulfilment" button** — calls `autoFulfilOrder(orderId)` server-side (idempotent
  on `order_id::provider`). Guard: only for retryable statuses.
- **`app/admin/orders/page.tsx`** — order number is now a `<Link>` to the detail page; rows
  highlight on hover.

### Verified

- `tsc --noEmit` clean.
- `next build` succeeds; `/admin/orders/[id]` present as dynamic route (`ƒ`).

## Step 5 — Owner alerts + `/admin/notifications` inbox ✅

Wired the attention-needed notification path end-to-end (§B-07 §14/15). Previously
`notifications` rows were inserted but the owner was never emailed and there was no
in-admin inbox.

### Built

- **`lib/notifications.ts` → `notifyOwner(eventType, subject, body)`** — single funnel
  all trigger sites call. Reads `store_settings.notification_prefs`; emails the owner
  via `sendOwnerAlert` only when that event type is enabled (missing key defaults to
  enabled, matching the seeded all-true default).
- **Three trigger sites wired** (each right after its existing `notifications.insert`):
  - `lib/fulfilment.ts` → `fulfilment_failed`
  - `app/orders/[order]/actions.ts` → `refund_requested`
  - `app/api/webhooks/stripe/route.ts` (`charge.dispute.created`) → `dispute_opened`
  - All fire-and-forget (`.catch(() => undefined)`) so a mail failure never breaks the
    order/fulfilment/refund flow.
- **`/admin/notifications` inbox** (ops only — master/regular via `requireOps` + RLS
  `notifications_ops`): unread-first list, per-row "mark read", "mark all read", links to
  the order. Empty state. `actions.ts` has `markRead` / `markAllRead` (service client,
  revalidates inbox + dashboard).
- **Nav + dashboard surfacing**: "Notifications" nav item (ops only) with an unread count
  badge; dashboard shows an unread-alerts banner linking to the inbox.
- **Settings**: per-event email toggles (`fulfilment_failed`, `refund_requested`,
  `dispute_opened`) persisted to `store_settings.notification_prefs`. All events still
  land in the inbox regardless of these toggles — the toggles only gate the _email_.

### Verified

- `tsc --noEmit` clean.
- `next lint` clean (only the pre-existing `<img>` warnings in `/admin/social`).
- `prettier --check .` clean.
- `next build` succeeds; `/admin/notifications` present in the route manifest (static).

### Not yet tested (needs live env / real events)

- Actual Resend delivery of an owner alert (no `.env.local` / `RESEND_API_KEY` in this
  fresh sandbox). Logic is exercised by typecheck/build; a real email send is gated on
  the end-to-end test purchase after Step 8.
- The inbox "View order →" link points at `/admin/orders/[id]`, which Step 6 builds; it
  will 404 until then.

---

## End-to-end test purchase ✅ (Stripe test mode, dry-run fulfilment)

`scripts/e2e-test.mjs` — **23/23 checks pass** against real Supabase + Stripe test mode,
`fulfilment_dry_run` ON (no real POD orders placed). Covers:

- Supabase connectivity (268 products), sample product+variant with provider IDs.
- Stripe test-mode Checkout Session creation (real, customer-clickable URL).
- `checkout.session.completed` webhook → order `pending`→`fulfilling`,
  `stripe_payment_intent_id` + `placed_at` recorded, dry-run `fulfilment_attempts`
  row written, `order_items` snapshot carries provider/product/variant IDs.
- `refund.updated` webhook → local `refunds` row `requested`→`completed`, **idempotent**
  (duplicate event ignored).
- Test data cleaned up afterwards.

Run: `node --env-file=.env.local scripts/e2e-test.mjs` (needs `next start` on :3000).

**Not covered** (needs a browser / live exposure): card entry on Stripe's hosted page;
inbound Printful/Printify tracking webhooks; real Resend delivery.

---

## High-severity audit items (post-launch-blockers)

### HS-1 — Home page metadata + JSON-LD ✅

`app/page.tsx` now exports explicit `metadata` (title/description/canonical/OG) instead of
relying on the layout default, and renders `WebSite` JSON-LD (`websiteLd()` added to
`lib/structured-data.ts`). Organization JSON-LD already in root layout.

### HS-2 — Sitemap includes /journal/\* ✅

`getPublishedPostSlugs()` added to `lib/queries.ts`; `app/sitemap.ts` now lists `/journal`

- every published post. (Still gated by `allowIndexing` — empty until cutover.)

### HS-3 — /cart/unsubscribe route ✅

Was referenced in the abandoned-cart email but didn't exist (404). Built
`app/cart/unsubscribe/page.tsx` + action that records the suppression. Email link now
carries `?email=`. New `email_suppressions` table (migration
`20260529120000_email_suppressions.sql`) — the abandoned-cart cron skips suppressed
addresses. Code is **defensive**: if the table isn't migrated yet, the page still confirms
and the cron treats everyone as subscribed. **⚠️ Owner must run the new migration SQL.**

### HS-4 — Abandoned-cart cron wired in wrangler.jsonc ✅

Added `triggers.crons: ["0 * * * *"]` + a custom `worker.js` entry that wraps OpenNext's
`fetch` and adds a `scheduled` handler which replays an authenticated internal POST to
`/api/cron/abandoned-cart`. Verified: `opennextjs-cloudflare build` succeeds and
`wrangler deploy --dry-run` bundles the worker with the `scheduled` handler present.
**⚠️ Owner must set `CRON_SECRET` as a Cloudflare secret.**

### HS-5 — Blog auto-queue trigger wired ✅

`autoQueueForProduct` was dead code. Added `app/admin/products/actions.ts`
`setProductStatus` + Publish/Unpublish buttons on the products list. A real
draft → published transition fires `autoQueueForProduct(id, "auto_new_product")`
(de-dup + graceful AI fallback already in `lib/blog.ts`). Verified the `blog_posts`
insert path against the live DB (correct columns). **On-sale trigger still pending** —
needs a product price-edit UI, which doesn't exist yet.

### HS-6 — PDF export of financial report ✅

Extracted the dashboard's Stripe+COGS calc into `lib/financial.ts`
`getFinancialSummary(from, to)` (single source of truth — page + exports share it).
Added `lib/pdf.ts` — a dependency-free single-page PDF builder (byte-accurate xref,
Helvetica text) that works on Cloudflare Workers where puppeteer/heavy libs can't.
New route `app/api/admin/financial.pdf` (ops only) + "Export PDF" link on the page.
Output validated: `file(1)` reports "PDF document, version 1.4, 1 page(s)", xref offsets
byte-accurate. Carries the estimate disclaimer.

### HS-7 — Refund request hardening ✅

Fixed a real money bug + added defence-in-depth to the guest refund flow
(`app/orders/[order]/actions.ts`), without committing to a full accounts system:

- **Amount + currency are now derived server-side from the order** — previously the
  client supplied them, and that value feeds the Stripe refund admins later action.
  A malicious caller could have requested an arbitrary refund amount. Now ignored.
- **Email confirmation**: requester must type the order email; verified case-insensitively
  against the row. Protects direct API calls and prevents accidental/automated requests.
- **Duplicate guard**: one open/completed refund per order (no spam / duplicate owner alerts).
- Client (`RequestRefund.tsx`) collects the email and surfaces the server error.
- Verified all three guards against the live DB (wrong email rejected, amount derived,
  duplicate rejected).

**Still open:** full customer accounts (login + order-history scoping + welcome email) remains
the larger separate effort; this hardening covers the immediate money-touching risk.

### HS-8 — Product edit page + on-sale blog trigger ✅

Built `/admin/products/[id]` — edit price, compare-at/was price, status, featured, SEO.
New `updateProduct` action fires the blog auto-queue on **two** transitions now:
draft→published (`auto_new_product`) and newly-on-sale, i.e. price drops below
compare_at_price (`auto_on_sale`). De-dup is a backstop. "Edit" link added to the
products list. This also gives the admin its first real product-edit capability
(previously read-only + publish toggle). Verified the full on-sale chain against a
throwaway product on the live DB: drop below compare-at → 1 draft queued; re-save while
on sale → no re-fire; de-dup held.

The §B-13 blog auto-queue (both triggers) is now complete.

### HS-9 — Customer accounts ✅

Full customer-account system (§B-05 optional accounts, §B-10 refund auth). Customers are
auth.users WITH a `customers` row — distinct from admins (who have a `public.users` row),
so customer sign-in never grants admin.

Built:

- **`lib/customer.ts`** — `getCustomer()` (cookie-scoped current customer) and
  `ensureCustomer()` (get-or-create on first sign-in: links a legacy same-email row,
  **backfills guest orders** by email so history is complete, sends the welcome email).
- **`/account/login`** — customer magic-link sign-in (`shouldCreateUser: true`), separate
  from the admin `/login`. Callback (`/auth/callback`) provisions the customer row when
  `next` targets `/account`.
- **`/account`** — editable profile (name) + order history (RLS-scoped).
- **`/account/orders/[id]`** — customer order detail with tracking + a **secure refund
  request** (`requestRefundAuthed`): the order is read through the cookie-bound client so
  RLS only returns it if owned — replacing the UUID-as-bearer guest flow. Blocks duplicate
  open requests; fires the owner alert + customer email.
- **Checkout** sets `orders.customer_id` when a customer is signed in.
- **Middleware** gates `/account/*` (except the login page) and bounces signed-in users off
  the login page. **Sign-out** now honours `?next=` (customers → "/", admins → "/login").
- **Header** gains an Account link; welcome email wired (was dormant).

Verified with a live RLS test using **real auth JWTs** (`scripts/account-rls-test.mjs`,
9/9): provisioning, guest-order backfill, and isolation — customer A sees exactly their own
orders and cannot read another customer's order or order_items.

Residual (accepted, not a blocker): the **guest** order-confirmation page `/orders/[id]`
still uses the unguessable order UUID as the bearer for its refund form — standard for
guest e-commerce status links. Account holders get the hardened RLS-scoped path.

### High-severity: all cleared.

---

## Medium / polish items

### MED-1 — Financial report: Stripe pagination ✅

`lib/financial.ts` was capped at `limit: 100` balance transactions — date ranges with
more were silently undercounting revenue/fees/refunds. Now uses
`.autoPagingToArray({ limit: 5000 })` (bounded for the Workers time limit). Verified the
API call + pagination works against the live test account.

### MED-2 — Journal markdown rendering ✅

`/journal/[slug]` rendered the body as `whitespace-pre-line`, so readers saw raw
`**markdown**`. Added `lib/markdown.tsx` — a dependency-free, XSS-safe markdown→React
renderer (renders to elements, never `dangerouslySetInnerHTML`; links restricted to
http/mailto). Covers headings, paragraphs, bold/italic/code, links, ordered/unordered
lists. Used in the journal post page.

### Still open (medium / polish)

- Variant-specific image on Stripe line items.
- Social scheduling.
- Order page client-poll for status flip.
- 301 redirect map from Shopify URLs (needs the old URL list).
- Audit log for kill-switch toggle.
- Replace `<img>` with `<Image>` in `/admin/social` (the 2 remaining lint warnings).
- Analytics + uptime monitoring.
- (done — see HS-9 above) Customer accounts.

### MED-3 — 301/308 redirect map from old Shopify URLs ✅

`scripts/generate-redirects.mjs` (read-only, re-runnable) pulls every Shopify product +
collection handle via the Admin API (client-credentials auth), matches products to our new
slug by `source_id` (the full Shopify gid), and writes `lib/redirects.json`, wired into
`next.config.mjs` `redirects()`.

Result: 62 redirects. All 268 migrated products kept their Shopify handle as their slug, so
they need NO redirect (handles preserved). The map covers: the 9 dropped JetPrint watches →
`/shop`, 44 old collection URLs → `/shop` (no per-collection equivalents migrated), and 9
static page paths (about/contact/shipping/size-guide) → their new pages. Verified live:
`/collections/accessories`, `/products/rose-metal-watch`, `/pages/about` all 308-redirect to
the right targets; a live product (`/products/mens-nomad-tee-green`) serves 200 unaffected.

Note: Next's `permanent: true` emits **308** (Permanent Redirect), which Google treats
identically to 301 for SEO/link-equity. True 301 status would require middleware on the
storefront hot path (perf cost); 308 is the idiomatic, zero-overhead choice. Re-run the
script before cutover to pick up any catalogue changes.

### MED-4 — Kill-switch / settings audit log ✅ (code; needs the audit_log migration run)

See migration `20260529130000_audit_log.sql`. `updateSettings` records actor + from→to for
auto_fulfilment_enabled, fulfilment_dry_run, vat_enabled, shipping_mode; settings page shows
the trail. Degrades gracefully until the table is created.
