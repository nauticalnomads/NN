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

### Next session

**Session 03 — Shopify migration** (Admin API → clean → map to provider → import), or **Session 04
— Storefront**. 03 needs your Shopify Admin API token + Printful/Printify keys.
