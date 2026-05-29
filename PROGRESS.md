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
3. ⏳ Printify live shipping — NEXT
4. ⏳ Admin shipping-zone editor
5. ⏳ Owner-alert wiring + `/admin/notifications` inbox
6. ⏳ `/admin/orders/[id]` detail + manual-fallback view + retry button
7. ⏳ Retry-with-backoff for transient POD failures
8. ⏳ Stripe `charge.refunded` / `refund.updated` reconciliation
