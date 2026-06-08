# Domain cutover — nauticalnomads.com: Shopify → Cloudflare Workers

**Your situation:** domain is **registered through Shopify**, and you have **business email on @nauticalnomads.com**.
**Implication:** you must (a) **transfer the registration to Cloudflare** (Shopify-managed domains can't use external nameservers), and (b) **replicate all email DNS in Cloudflare before the nameservers switch**, or email breaks.

Do the phases in order. The site + email keep working on Shopify until Phase 3 completes, so there's no downtime if you prep DNS first.

---

## ⚠️ Two things that will bite if ignored

1. **60-day transfer lock.** ICANN blocks transfers within 60 days of a domain's registration or last transfer. If you registered/renewed-via-transfer recently, Shopify will refuse the transfer and you must wait. (A normal renewal does NOT trigger this; only registration/transfer does.)
2. **Email DNS must be copied first.** The moment nameservers point to Cloudflare, Cloudflare's DNS becomes authoritative. If your MX/SPF/DKIM/DMARC records aren't already in Cloudflare, inbound + outbound mail stops.

---

## Phase 0 — Record everything (do this first, change nothing)

In **Shopify admin → Settings → Domains → nauticalnomads.com → DNS settings**, screenshot / copy **every** record. You especially need:

- **MX** records (mail routing) — e.g. Google Workspace `aspmx.l.google.com` etc., or Outlook `…mail.protection.outlook.com`.
- **TXT — SPF** (`v=spf1 …`).
- **DKIM** (often `google._domainkey` / `selector._domainkey` as CNAME or TXT).
- **TXT — DMARC** (`_dmarc`).
- Any **CNAMEs** (autodiscover, mail, tracking, Resend verification, etc.).
- The current **A record** for the website (Shopify's, `23.227.38.x`) and the `www` CNAME (`shops.myshopify.com`) — you will REPLACE these, not copy them.

> Tip: also run `dig nauticalnomads.com any +noall +answer` and `dig MX nauticalnomads.com` from a terminal to capture the live records independently.

---

## Phase 1 — Create the Cloudflare zone & pre-stage DNS (no downtime)

1. Cloudflare dashboard → **Add a site** → `nauticalnomads.com` → **Free** plan.
2. Cloudflare auto-scans existing DNS. **Carefully verify every record from Phase 0 is present** — auto-import often misses some. Manually add any missing **MX / SPF / DKIM / DMARC / CNAME** records.
   - MX and other mail records must be **DNS only (grey cloud)** — never proxied.
3. **Do NOT yet** create the website A/CNAME to the Worker (Phase 3 does that cleanly). Leave the old Shopify A/`www` records out, or set them grey-cloud temporarily — they'll be replaced.
4. Cloudflare shows you **two assigned nameservers** (e.g. `xxx.ns.cloudflare.com`). Note them. The zone stays **"Pending"** until nameservers point here (which the transfer does in Phase 2).

---

## Phase 2 — Transfer the registration to Cloudflare

1. **Shopify admin → Settings → Domains → nauticalnomads.com:**
   - Turn **off** "Transfer lock" / domain lock.
   - Click **Transfer domain → Transfer to another provider** → **get the authorization (EPP) code**.
   - Make sure the domain's WHOIS/contact email is one you can receive on (the transfer approval goes there). ⚠️ If that contact email is itself `@nauticalnomads.com`, confirm you can read it during the transfer.
2. **Cloudflare → Registrar → Transfer Domains** → select `nauticalnomads.com` → paste the **auth code** → confirm and pay the (at-cost) 1-year renewal.
3. Approve the transfer email if one arrives. Transfer typically completes in **a few hours up to 5 days**. During this window DNS keeps resolving via Shopify, so nothing breaks.
4. When the transfer completes, Cloudflare sets **its nameservers** and the zone flips to **"Active."** **This is the cutover moment** — your Phase 1 DNS (incl. email) goes live. Verify email still flows immediately after (send a test in + out).

> Can't wait for the transfer? There's no shortcut for a Shopify-managed domain — Shopify won't let you set Cloudflare nameservers without transferring. (If you'd rather, transfer to any registrar that allows custom NS, then point NS at Cloudflare — but Cloudflare Registrar is the simplest end state.)

---

## Phase 3 — Point the website at the Worker

Once the zone is **Active** on Cloudflare:

1. **Workers & Pages → `nn` → Settings → Domains & Routes → Add Custom Domain:**
   - Add `nauticalnomads.com` **and** `www.nauticalnomads.com`.
   - Cloudflare auto-creates the proxied records and issues SSL (a few minutes). This replaces Shopify's A record, so the apex now serves your site.
2. Pick a canonical host (recommend apex `nauticalnomads.com`) and add a **redirect rule** `www → apex` (or vice-versa) under Rules → Redirect Rules.
3. Keep the existing **nautical-nomads.com** (hyphen) Worker domain as a 301 → `nauticalnomads.com` so old links/SEO transfer.

---

## Phase 4 — App config (env + redeploy)

In **Cloudflare → `nn` → Settings → Variables and Secrets**, set/confirm:

- `NEXT_PUBLIC_SITE_URL = https://nauticalnomads.com` ← drives canonicals, sitemap, OG, Stripe success/cancel URLs, webhook URLs.
- `NEXT_PUBLIC_ALLOW_INDEXING = true` ← flips robots/sitemap from "noindex" to live (only after you're happy).
- Then **redeploy** the Worker so the env changes take effect.

Then update the external services to the new host:

- **Stripe** → Webhooks → edit the live endpoint URL to `https://nauticalnomads.com/api/webhooks/stripe`.
- **Printful / Printify** webhook URLs → swap the host to `nauticalnomads.com` (token stays the same).
- **Resend** → if you send from `@nauticalnomads.com`, re-add Resend's SPF/DKIM records in the **new Cloudflare DNS** and re-verify the domain (the old verification lived in Shopify DNS).
- Re-run the Shopify→new-site **redirect map** (`scripts/generate-redirects.mjs`) before flipping, so old `/products`, `/collections`, `/pages` URLs 301 correctly.

---

## Phase 5 — Verify, then retire Shopify

1. `https://nauticalnomads.com` loads the new site, valid SSL, `www` redirects, no mixed content.
2. **Email test:** send to and from a `@nauticalnomads.com` address; confirm MX intact and SPF/DKIM pass (check headers).
3. Checkout end-to-end on the live domain (live Stripe), order → `paid` → receipt email.
4. Google Search Console: add the property, submit `sitemap.xml`.
5. In Shopify, **unpublish the online store** / remove the domain from the storefront. Keep Shopify admin ~30 days (read-only) for old-order lookups, then cancel.

---

## What I (Claude) can do on the code side

- Change the app's default `site.url` and the documented webhook URLs from `nautical-nomads.com` → `nauticalnomads.com`.
- Re-run / refresh the redirect map.
- Add the `www → apex` canonical handling in app if you prefer it in-code vs a Cloudflare rule.

Say the word and I'll open a PR for those — but the env var (`NEXT_PUBLIC_SITE_URL`) is the real switch, and that's yours to set in Cloudflare.

## What's yours only (I have no access)

- Cloudflare account: Add site, Registrar transfer, Custom Domains, DNS records, env vars.
- Shopify admin: unlock + auth code, then unpublish.
- Stripe / Resend dashboards: endpoint URL + domain re-verification.
