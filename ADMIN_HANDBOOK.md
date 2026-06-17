# Nautical Nomads — Admin Handbook

A plain-English guide to running the shop from the admin panel. No technical
knowledge needed. Keep this handy; it explains every screen, button, and the
behind-the-scenes automation in simple terms.

- **Admin address:** `https://nauticalnomads.com/admin`
- **Sign in:** `https://nauticalnomads.com/login` (staff login — different from the
  customer account login)
- **Tip:** press **⌘K** (Mac) or **Ctrl-K** (Windows) anywhere in admin to jump to
  any page or search products/orders instantly.

---

## 1. The basics

### Who can do what (staff roles)

There are three staff levels. You set a person's level on the **Users** page.

| Role        | What they can do                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Master**  | Everything, including managing staff (Users).                                                                            |
| **Regular** | Everything except managing staff — orders, money, settings, content.                                                     |
| **Content** | Editorial only: Products, Collections, Homepage content, Social, Reviews, Blog. No access to orders, money, or settings. |

If someone opens a page they're not allowed to, they're sent back to the
dashboard with a short "insufficient permissions" note.

### Adding a staff member

1. Go to **Users** (Master only).
2. Enter their email, pick a role, click **Invite**. They get an email to set a
   password. Once they accept, they appear in the list.
3. You can change anyone's role with the dropdown + **Save**, or **Deactivate**
   them to revoke access without deleting them.

---

## 2. Dashboard (your home screen)

The first thing you see. For Master/Regular it shows live numbers:

- **Revenue today** and **Revenue 7 days**
- **Orders today**
- **Needs action** — orders waiting on you (failed fulfilment / paused). Click it
  to jump straight to those orders.
- **Open carts (7d)** — checkouts started but not paid.
- **Credit liability** — total unspent store credit you owe customers.
- **Products** and **Drafts** counts.

If anything needs attention, a banner links you to it. It's a read-only
overview — nothing to click except the shortcuts.

---

## 3. Selling: orders, customers, refunds

### Orders

**Orders** lists the most recent orders, newest first, with anything that needs
attention pinned to the top. Use the **filter chips** (All / Needs action / Open
carts / Paid / Fulfilling / Shipped / Delivered / Cancelled-refunded) to narrow
the view, and **Export CSV** to download the current view for your records.

Click an order to open it. The order page shows:

- **Timeline** — the order's whole life in order: checkout opened → paid →
  fulfilment → tracking → refunds.
- **Customer** — email, address, and a **View customer →** link.
- **Items**, **Tracking**, **Fulfilment history**.
- **Order actions:**
  - **Mark fulfilled** / **Mark delivered** — update status by hand.
  - **Mark shipped & email customer** — add carrier + tracking number; the
    customer is emailed the tracking link.
  - **Cancel order** — stop an unshipped order (does not refund money).
  - **Refund £X** — issues a full refund through Stripe and marks the order
    refunded.
- **Manual fallback** (appears when auto-fulfilment is paused or failed) — lets
  you record a provider order reference + tracking by hand, or hit
  **Retry auto-fulfilment** to try sending it to Printful/Printify again.

### Customers

**Customers** (Master/Regular) lists everyone who's created an account, with
their order count and lifetime spend. Search by email. Open a customer to see
their lifetime value, full order history, store-credit ledger, and who they've
referred.

### Refunds

**Refunds** lists refund requests from customers and refunds you've issued. For a
request still marked "requested", click **Issue refund** to push it through
Stripe. (You can also refund directly from an order page.)

### Notifications

**Notifications** is your action inbox — only things that need you: failed
fulfilments, refund requests, payment disputes. Routine orders are **not** here
(they're in Orders). Click **Mark all read** when you've dealt with them. You can
also choose which of these email you (Settings → Owner email alerts).

---

## 4. Your catalogue: products & collections

### Importing products from Printful

1. Go to **Products → Import from Printful**.
2. The top of the page tells you if you're **connected to Printful** (it shows
   your store name) or warns that the key isn't set.
3. Click **Import all new** to pull in every product you haven't imported yet, or
   **Import** next to a single item. (Imports come in as **drafts** so nothing
   goes live by accident.)
4. If a product won't appear, paste its Printful ID into **Import by ID**.

> Printify products are imported/managed the same way once configured; mapping
> happens by the provider IDs stored on each product.

### Products

The **Products** list is split into **Drafts** (not live) and **Published**
(live). For each product you can:

- Set its **Category** (this files it into the matching collection).
- **Publish** / **Unpublish** it.
- Tick several and use **Publish / Unpublish** at the top to do them in bulk.
- **Export CSV** of the catalogue.

Open a product to set **price**, **compare-at (was) price** (setting price below
this marks it on sale), **status**, **Featured on home page**, description, and
SEO. **✨ Generate SEO with AI** fills the SEO fields for you. Below that you
manage **photos** — upload, reorder, set the primary image, delete.

### Collections

**Collections** are your shop categories (Men, Women, Swimwear, etc.). They're
seeded as drafts. A collection only appears in the site's menu **once it's
published and has at least one product**. Open one to set its title, cover photo
(this is also its mega-menu image), description, and which products belong to it.
**Bulk product tagger** assigns many products to categories at once.

---

## 5. Marketing & content

### Homepage & Content

**Homepage & Content** edits the storefront's look without a developer: the hero
collage, featured carousel, editorial banners, campaign title, photo strip,
category tiles, footer tag pills, and the newsletter discount code. Each block
has its own **Save** and changes appear live immediately. (The mega menu builds
itself from your published collections.)

### Promotions (discount codes)

**Promotions** (Master/Regular) creates **percent-off codes** used at checkout.

- Fill in **Code**, **Percent off**, optional **Starts/Ends** dates and an
  internal **Note**, then **Create code**.
- Each code shows a status: **Live**, **Scheduled** (start date in the future),
  **Expired**, or **Off**.
- **Turn off/on** a code without deleting it, or **Delete** it.
- The built-in **STUDENT5** (5% student code) and **WELCOME10** (10% newsletter
  welcome) codes keep working alongside any you create.

### Gift cards & Store credit

- **Gift cards** lists every card sold and its remaining balance, plus your total
  outstanding gift-card liability (money customers can still spend).
- **Store credit** is the loyalty + referral ledger. Customers earn **5% back**
  as credit on what they spend, and referrals reward both people. You can also
  **grant credit manually** (goodwill/support) by entering a customer's email and
  an amount. The page shows your total outstanding credit liability.

### Reviews

**Reviews** holds customer reviews for moderation. New reviews wait in
**Pending** — click **Approve** to publish to the product page or **Reject** to
hide. Only customers who actually bought the item can leave a review, and they're
marked **Verified purchase**.

### Blog (Journal)

**Blog** manages your journal posts. Drafts auto-appear when you publish a new
product or put one on sale. You can also paste a link into **Draft from URL** and
it writes a draft for you. For each draft: **Edit**, **Publish**, or **Schedule**
it for a future date/time (it publishes automatically). Posts linked to a product
show a "Shop this story" section on the site.

### Emails

**Emails** (Master/Regular) lets you edit every email the shop sends — subject,
heading, and body — using `{{placeholders}}` for the dynamic bits (listed beside
each template). Leave a field blank to use the built-in wording. **Email
branding** sets the logo and the rotating header cover images. Use **Send test to
me** to preview one in your own inbox, or **Reset to default** to revert.

---

## 6. Social media autopilot

This keeps your Instagram/Facebook posting itself. Found under **Social**.

### How it works, simply

1. You drop photos into the shared **Google Drive folder**.
2. The system reads that folder and shows the photos as an Instagram-style grid.
3. **Autopilot** keeps **20 captioned posts** queued at all times, publishing
   **twice a day at 10:00 and 17:00 GMT**. When one posts, it generates and
   schedules the next automatically — no manual work.
4. **Newest photos go first.** When you add new photos to Drive, they're used
   before older ones; old photos are only reused once the new ones run out.

### What you do on the Social page

- **Autopilot** card: **Turn on/off**. When on, it shows how many of the 20 are
  scheduled.
- **Grid order:** drag the photos into the order you want, then **Save order** —
  this rebuilds the queue in that sequence. (Use this to push specific photos to
  the front.)
- **Scheduled** list: every queued post with its time. Per post: **Post now**
  (publish immediately), **Regenerate** (new AI caption), **Unschedule**,
  **Discard**.
- **Drafts:** unscheduled posts you can **Schedule** or **Post now**.
- **Recent:** what's gone out (or failed). Failed ones have a **Retry** button.

> Captions are written automatically by AI in your **Brand voice** (set in
> Settings). The actual posting to Instagram/Facebook happens through your
> **Make.com** connection.

---

## 7. Money: Financial

**Financial** (Master/Regular) gives estimates to help with bookkeeping —
revenue, Stripe fees, refunds, estimated cost of goods, and estimated profit for
a date range you choose. **Export CSV** or **Export PDF** for your accountant.
It's an estimate, not a replacement for proper accounting.

---

## 8. Settings & connections

**Settings** (Master/Regular) is where the shop's plumbing lives.

### The important safety switches (top of the page)

- **Auto-fulfilment enabled** — the master kill-switch. **On** = paid orders are
  sent to Printful/Printify automatically. **Off** = paid orders wait as
  "awaiting fulfilment" for you to handle by hand.
- **Fulfilment dry-run** — a safety net. **On** = orders are _not_ really sent to
  the providers (it just records a pretend "DRYRUN" attempt). **Turn this OFF**
  when you're ready for real orders to be placed.
- **VAT enabled / rate** — leave VAT off until you're VAT-registered.
- **Shipping mode** — _Live POD quotes_ (real-time rates from the providers, with
  flat rates as a backup) or _Flat zone rates_ (your own fixed rates).
- **Owner email alerts** — which attention events email you (they always appear
  in Notifications regardless).
- **Brand voice** — the description the AI uses when writing captions and blog
  drafts.

### Connections you can paste in (no developer needed)

Each section shows a ✓ / ✗ status so you can see what's connected:

- **Social automation:** Google service account JSON, Google Drive folder ID,
  Email-covers folder ID, and the Make.com webhook URL.
- **POD providers:** Printful API key / Store ID / webhook secret, and Printify
  API key / Shop ID / webhook secret. The page also shows the **webhook URLs to
  paste into Printful's and Printify's dashboards** so they can tell us when an
  order ships.

> Secret fields are write-only — once saved they show "set" but never display the
> value back, for safety.

---

## 9. How an order flows (start to finish)

1. Customer pays → **Stripe** confirms the payment to us (we trust the payment
   confirmation, not the "thank you" page).
2. The order is marked **paid** and, if **Auto-fulfilment** is on and
   **dry-run** is off, it's sent to **Printful** and/or **Printify** automatically
   (each item goes to its own provider).
3. Status moves to **fulfilling**. If a provider rejects it, status becomes
   **fulfilment failed** and you get a notification.
4. When the provider ships, their **webhook** adds tracking and moves the order to
   **shipped**, and the customer is emailed the tracking link. Later it can be
   marked **delivered**.
5. You can step in at any point from the order page (manual fallback, mark
   shipped, refund, etc.).

Everything is **idempotent** — re-running or duplicate provider messages can't
double-place an order or double-charge anything.

---

## 10. Are Printful & Printify actually connected? (how to check)

The connection is configured in **Settings → POD providers** (or via the
Cloudflare environment).

**Quickest check — the "Test connections" button.** In **Settings → POD
providers** click **Test connections**. It pings Printful, Printify and Stripe
live with your saved keys and shows **✓ live** (authenticated) or **✗ fail**
with the reason (e.g. "Key rejected", "no Shop ID set"). This confirms the keys
actually work, not just that they're filled in.

Other ways to verify:

1. **Printful:** open **Products → Import from Printful**. If the top says
   **"✓ Connected to Printful"** with your store name, the API key works. If it
   says the key isn't set, paste it in Settings.
2. **Printify:** in **Settings → POD providers**, confirm **API key ✓** and a
   **Shop ID** are shown. (Printify needs the Shop ID as well as the key.)
3. **Shipping:** add a real product to a basket and go to checkout — if you're in
   _Live_ shipping mode and see a calculated rate, the providers are answering.
4. **Webhooks (ship notifications):** copy the webhook URLs shown in Settings into
   each provider's dashboard, and set the matching **webhook secret** in Settings.
   Without these, orders still place but won't auto-update to "shipped".
5. **End-to-end test:** with **dry-run ON**, place a test order — the order page's
   **Fulfilment history** will show a "DRYRUN" attempt, proving the pipeline runs.
   Turn dry-run **OFF** to go live.

---

## 11. Search (⌘K)

Press **⌘K** / **Ctrl-K** (or click **Search…** in the sidebar) to open the
command palette. Type to jump to any admin page, or search **products** (by name)
and **orders** (by email or order number). Arrow keys to move, Enter to open,
Esc to close.

---

## 12. Going-live checklist

- [ ] **Settings → Fulfilment dry-run = OFF** (so real orders are placed).
- [ ] **Settings → Auto-fulfilment = ON** (unless you want to fulfil by hand).
- [ ] Printful + Printify **API keys, Store/Shop IDs, and webhook secrets** set;
      webhook URLs pasted into both provider dashboards.
- [ ] **Stripe** live keys + webhook configured.
- [ ] Search indexing on (set automatically; see your developer if `robots.txt`
      still disallows crawling).
- [ ] Social automation: Google Drive + Make.com connected, Autopilot **On**.
- [ ] A few **collections published** (each with products) so the menu populates.

---

## 13. Quick troubleshooting

- **"A social post failed."** Open **Social → Recent** and hit **Retry**. If it
  keeps failing, the issue is on the Make.com → Instagram side (usually an
  expired Instagram connection or the image — see your developer; the system now
  logs the exact reason).
- **"An order didn't go to the provider."** Check **Settings**: is dry-run on, or
  auto-fulfilment off? Then use **Retry auto-fulfilment** or the manual fallback
  on the order page.
- **"A discount code isn't working."** Check it's **Live** (not Scheduled/Expired/
  Off) on the Promotions page.
- **"New Drive photos aren't posting."** They're picked up within the hour; to
  push them out now, drag them to the top of the Social grid and **Save order**.
- **"A customer can't leave a review."** Only verified buyers (signed in, with a
  paid order for that product) can review.

---

_Questions this handbook doesn't answer? They're usually a Settings connection or
a developer task — note the exact screen and message and pass it on._
