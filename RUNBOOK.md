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

1. **Decide cutover window** (low-traffic, e.g. early Sunday morning).
2. **Flip indexing on**: set `NEXT_PUBLIC_ALLOW_INDEXING=true` in Cloudflare.
3. **Re-deploy** to apply the env change.
4. **DNS swap**: in Cloudflare DNS, point `nauticalnomads.com` A/AAAA + `www`
   CNAME at the new platform (or use Cloudflare Pages custom domain).
5. **301 redirects** from old Shopify URLs → new equivalents. Map:
   - `/products/{handle}` → `/products/{slug}` (slugs may match; verify)
   - `/collections/{handle}` → `/collections/{slug}`
   - `/blogs/{section}/{post}` → `/journal/{slug}` (if applicable)
   - Everything else → home page (catch-all 301)
6. **Switch Stripe to live keys**:
   - Update `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Cloudflare.
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
- Review JetPrint products' `compare_at_price` validity.

### Quarterly

- Rotate Stripe webhook signing secrets (and update env).
- Rotate POD API keys.

---

## 4. Re-running the Shopify migration

The migration is idempotent. Re-run it after:

- New products added in Shopify (until Shopify is decommissioned).
- Provider mapping corrected on the POD side.
- A `compare_at_price` was reversed on a flagged JetPrint watch.

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
