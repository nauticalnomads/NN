# Nautical Nomads — Operations Runbook

Routine ops + pre-launch checklist + go-live cutover. Sister to PROGRESS.md
which logs what was built session by session.

## 1. Pre-launch checklist (Session 14)

Tick everything in this list before pointing `nauticalnomads.com` at the new
platform. Test in this order; each item assumes the ones above pass.

### Storefront

- [ ] Home, /shop, /collections/[slug], /products/[slug], /about, /contact,
      /shipping-returns, /size-guide, /journal all render in production.
- [ ] Mobile + desktop both clean. Lighthouse passes on perf + a11y.
- [ ] Image alt text checked on a sample of products (`/admin/products`).
- [ ] 404 renders the styled "drifted off the chart" page.
- [ ] Search engines: `/robots.txt` shows `Disallow: /` until cutover, then
      flip `NEXT_PUBLIC_ALLOW_INDEXING=true` in Cloudflare.

### Cart + checkout

- [ ] Add to bag from PDP works; mini-cart updates.
- [ ] `/cart` shows items, qty +/-, remove, subtotal.
- [ ] `/checkout` collects email + address; Stripe redirect works.
- [ ] **Live-mode** Stripe test purchase end-to-end:
  - [ ] Order row created in `pending`.
  - [ ] After payment, `checkout.session.completed` webhook flips to `paid`.
  - [ ] Order confirmation email arrives.
  - [ ] Auto-fulfilment triggers (with `fulfilment_dry_run=true` initially).
  - [ ] Stripe receipt arrives.

### Shipping

- [ ] Live quotes return for Printful-only and Printify-only carts.
- [ ] Mixed cart sums per-provider; failure on one provider falls back to
      flat zones without blocking checkout.
- [ ] Admin shipping mode toggle (live ↔ flat) works.
- [ ] Flat zones editable.

### Orders + fulfilment

- [ ] `/admin/orders` lists; failed/attention-needed pinned to top.
- [ ] `fulfilment_dry_run=false` enabled → real Printful + Printify orders place.
- [ ] Tracking webhook updates `tracking[]` on the order.
- [ ] Shipping email auto-sends with tracking link, no owner input.
- [ ] Kill-switch test: toggle `auto_fulfilment_enabled=off`, place an order,
      confirm status lands as `awaiting_fulfilment` and no provider call fires.

### Refunds

- [ ] Customer can request refund from `/orders/[id]`.
- [ ] Admin can issue Stripe refund from `/admin/refunds`.
- [ ] Refund webhook updates the row idempotently.
- [ ] Customer receives refund-completed email.

### Roles + auth

- [ ] Master, regular, content roles all enforced both in UI and server-side
      (try direct URL access to a forbidden admin page → redirect).
- [ ] Master can invite users, set role, deactivate.

### Financial

- [ ] `/admin/financial` shows revenue/fees/refunds/COGS/profit for the period.
- [ ] CSV export works.
- [ ] Estimate disclaimer present.

### Email journeys

- [ ] Order confirmation, shipping, refund (requested + completed), welcome.
- [ ] Abandoned cart cron runs and stops on order completion.
- [ ] Owner alert emails for fulfilment_failed / refund_requested / dispute_opened.

### Social + blog

- [ ] Drive images list under `/admin/social`.
- [ ] Caption generator works (Anthropic).
- [ ] Make.com webhook receives draft on Post.
- [ ] Blog draft auto-queues when a product is published (verify via the
      product publish path in `/admin/products`).
- [ ] Manual URL paste under `/admin/blog` produces a brand-voice draft.
- [ ] `/journal` and `/journal/[slug]` render.

### SEO

- [ ] `sitemap.xml` populated when `NEXT_PUBLIC_ALLOW_INDEXING=true`.
- [ ] `robots.txt` flips to `Allow: /` when indexing is enabled.
- [ ] Rich-results test passes for a product page (Product JSON-LD).
- [ ] OG/Twitter cards preview correctly.

---

## 2. Cutover (D-day)

> **⚠️ Build-time vs runtime env vars — read this before flipping anything.**
>
> Three variables are **`NEXT_PUBLIC_*`** and are **baked in at build time**
> (inlined by Next via the `env` block in `next.config.mjs`):
>
> - `NEXT_PUBLIC_SITE_URL` → `https://nauticalnomads.com`
> - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_…`
> - `NEXT_PUBLIC_ALLOW_INDEXING` → `true`
>
> These must be set as **build environment variables** (Cloudflare → Workers →
> the project → Settings → **Build** → Variables) **and a fresh build + deploy
> run afterwards**. Setting them as Worker **runtime secrets** (via
> `wrangler secret put`, or Settings → Variables and Secrets) has **no effect**
> on these three — the value is already compiled into the bundle. Concrete
> failure modes:
>
> - `pk_live_…` set only as a runtime secret → **checkout still loads the test
>   publishable key** (payments look fine in test, never go live).
> - `NEXT_PUBLIC_ALLOW_INDEXING` not present at build → **live site stays
>   `noindex` + `robots: Disallow /`** → invisible to Google even after you
>   submit the sitemap in Search Console.
> - `NEXT_PUBLIC_SITE_URL` stale at build → canonical tags, `sitemap.xml`, and
>   `robots.txt host` all emit the old default.
>
> Everything **server-only** is read at **runtime** — set these as Worker
> secrets, no rebuild needed: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
> `RESEND_API_KEY`, `RESEND_FROM`, `OWNER_ALERT_EMAIL`, `PRINTFUL_API_KEY`,
> `PRINTFUL_WEBHOOK_SECRET`, `PRINTIFY_*`, `CRON_SECRET`, the Supabase
> service-role key. (POD keys/secrets can also live in `store_settings` via
> `/admin/settings`, which takes precedence over the env fallback.)

1. **Decide cutover window** (low-traffic, e.g. early Sunday morning).
2. **Flip indexing on**: set `NEXT_PUBLIC_ALLOW_INDEXING=true` as a **build**
   variable in Cloudflare (see the callout above — not a runtime secret).
3. **Re-build + re-deploy** to apply the env change (a plain restart/rollback
   won't pick up a new `NEXT_PUBLIC_*` value — it has to be a fresh build).
4. **DNS swap**: in Cloudflare DNS, point `nauticalnomads.com` A/AAAA + `www`
   CNAME at the new platform (or use Cloudflare Pages custom domain).
5. **301 redirects** from old Shopify URLs → new equivalents. Map:
   - `/products/{handle}` → `/products/{slug}` (slugs may match; verify)
   - `/collections/{handle}` → `/collections/{slug}`
   - `/blogs/{section}/{post}` → `/journal/{slug}` (if applicable)
   - Everything else → home page (catch-all 301)
6. **Switch Stripe to live keys**:
   - Update `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` as **runtime** Worker
     secrets in Cloudflare (read at request time — no rebuild needed).
   - Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_…` as a **build**
     variable, then **rebuild + redeploy** (per the callout above).
   - Update the webhook endpoint URL in Stripe dashboard if it changed.
7. **Verify** in this order: home renders → product page → add to bag →
   checkout → live-mode purchase end-to-end → refund.
8. **Disable the Shopify storefront** but keep admin access for 30 days
   (read-only) in case you need to look up an old order.
9. **Export final Shopify backup** (Admin → Apps → matrixify or equivalent).
10. **Watch closely for 48 h**: error monitor, Stripe events, fulfilment_failed
    notifications.
11. **Decommission Shopify** after 30 days of clean operation.

---

## 3. Routine ops

### Daily

- Check `/admin` dashboard for headline counts.
- Skim `/admin/orders` — anything `fulfilment_failed` is pinned to the top.

### Weekly

- Review `/admin/blog` draft queue (auto-queued from product events).
- Review `/admin/social` drafts and post / schedule.
- Glance at financial dashboard for the week.

### Monthly

- Export financial CSV for the accountant.
- Check for unmapped products (`/admin/products` → filter `provider = null`).

### Quarterly

- Rotate Stripe webhook signing secrets (and update env).
- Rotate POD API keys.

---

## 4. Re-running the Shopify migration

The migration is idempotent. Re-run it after:

- New products added in Shopify (until Shopify is decommissioned).
- Provider mapping corrected on the POD side.
- A `compare_at_price` was reversed on a flagged product.

```bash
# Dry run first to see what'll change
npm run migrate:shopify:dry

# Real run
npm run migrate:shopify
```

Flags: `--limit N`, `--skip-images`, `--skip-costs`, `--report ./report.md`.

---

## 5. Kill-switches & emergency

- **Pause auto-fulfilment**: `/admin/settings` → toggle off
  `auto_fulfilment_enabled`. Paid orders queue as `awaiting_fulfilment`.
- **Block checkout entirely**: in Cloudflare, set a temporary route rule to
  return 503 on `/checkout` (until you can unset the cause).
- **Roll back deploy**: Cloudflare → Workers → Deployments → roll back.

---

## 6. Where to find things in the repo

- `app/` — Next.js routes (storefront + admin + api)
- `lib/` — server libs (stripe, supabase, shipping, fulfilment, email, etc.)
- `components/` — UI building blocks (cart, product card, admin shell)
- `scripts/` — migration + inspection (Node ESM)
- `supabase/migrations/` — versioned SQL (apply in order)
- `RUNBOOK.md` — this file
- `PROGRESS.md` — running session log
