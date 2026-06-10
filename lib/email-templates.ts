// Editable email templates (admin → Emails). Every transactional/journey email
// is defined here as a default subject + heading + HTML body with {{variable}}
// placeholders. Merchants can override any of them in the admin; overrides live
// in the `email_templates` table and fall back to these code defaults, so the
// emails keep working before the table exists or when a field is left blank.
//
// Rendering is two-pass: the email's own body is interpolated with its
// variables, then wrapped by the shared `layout` template (also editable),
// which receives {{heading}} and {{body}}.
import { createServiceClient } from "@/lib/supabase/service";
import { site } from "@/lib/site";
import { listEmailCoverImages, driveImageUrl } from "@/lib/google-drive";

export const LAYOUT_KEY = "layout";

export type EmailVar = {
  name: string;
  description: string;
  sample: string;
};

export type EmailTemplateDef = {
  key: string;
  label: string;
  description: string;
  internal?: boolean; // sent to the owner, not customers
  defaultSubject?: string; // layout has no subject of its own
  defaultHeading?: string;
  defaultBody: string;
  vars: EmailVar[];
};

// Shared shell. {{heading}} and {{body}} are filled by the rendered email;
// {{logo_block}} and {{cover_block}} are built from the admin "Email branding"
// images (Admin → Emails); the rest are site constants.
const LAYOUT_DEFAULT = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{heading}}</title></head>
<body style="margin:0;background:#FAF6EC;font-family:-apple-system,BlinkMacSystemFont,Helvetica,sans-serif;color:#2A2826;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EC;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FAF6EC;width:560px;max-width:100%">
        <tr><td style="padding:8px 24px 0">{{logo_block}}</td></tr>
        {{cover_block}}
        <tr><td style="padding:0 24px">
          <h1 style="margin:24px 0 0;font-size:28px;line-height:1.15;color:#2A2826;font-weight:400">{{heading}}</h1>
          <div style="margin-top:20px;font-size:16px;line-height:1.6;color:#2A2826">{{body}}</div>
          <hr style="border:none;border-top:1px solid rgba(42,40,38,0.1);margin:40px 0 24px"/>
          <p style="font-size:12px;color:rgba(42,40,38,0.5);margin:0">{{site_name}} · Live by the tide · <a href="{{site_url}}" style="color:rgba(42,40,38,0.5)">{{site_url}}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const ACCENT = "#C75D3E";
const sampleTable = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse"><tr><td style="padding:8px 0;font-size:14px">Tide Tee <span style="color:rgba(42,40,38,0.5)">· Sand / M</span> × 1</td><td align="right" style="padding:8px 0;font-size:14px;font-family:ui-monospace,monospace">£28.00</td></tr><tr><td colspan="2" style="border-top:1px solid rgba(42,40,38,0.1);padding-top:12px"></td></tr><tr><td style="padding:6px 0;font-size:14px"><strong>Total</strong></td><td align="right" style="padding:6px 0;font-family:ui-monospace,monospace"><strong>£28.00</strong></td></tr></table>`;
const sampleTracking = `<table cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td style="padding:4px 12px 4px 0;font-size:12px;color:rgba(42,40,38,0.5);text-transform:uppercase;letter-spacing:1px">Carrier</td><td style="font-family:ui-monospace,monospace;font-size:14px">Royal Mail</td></tr><tr><td style="padding:4px 12px 4px 0;font-size:12px;color:rgba(42,40,38,0.5);text-transform:uppercase;letter-spacing:1px">Tracking</td><td style="font-family:ui-monospace,monospace;font-size:14px">AB123456789GB</td></tr></table>`;

// All editable templates. Keys are stable identifiers used as the DB primary key.
export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    key: LAYOUT_KEY,
    label: "Layout (shell)",
    description:
      "The wrapper around every email — header, footer and colours. {{body}} is where each email's content goes.",
    defaultBody: LAYOUT_DEFAULT,
    vars: [
      {
        name: "heading",
        description: "The email's heading (its own title).",
        sample: "Thanks — that's in.",
      },
      { name: "body", description: "The rendered email content.", sample: "<p>…</p>" },
      { name: "site_name", description: "Store name.", sample: site.name },
      { name: "site_url", description: "Store URL.", sample: site.url },
      {
        name: "logo_block",
        description: "Logo image (or wordmark) — set the image in 'Email branding' above.",
        sample: "",
      },
      {
        name: "cover_block",
        description: "Optional cover banner row — set the image in 'Email branding' above.",
        sample: "",
      },
    ],
  },
  {
    key: "order_confirmation",
    label: "Order confirmation",
    description: "Sent to the customer once payment is confirmed.",
    defaultSubject: "Order received — {{order_number}}",
    defaultHeading: "Thanks — that's in.",
    defaultBody: `<p>Thanks — your order's in. The full receipt is below.</p>
{{items_table}}
<p style="margin-top:24px">We'll send tracking the moment it ships.</p>
<p><a href="{{order_url}}" style="color:${ACCENT}">View your order</a></p>`,
    vars: [
      { name: "order_number", description: "Order number (or short id).", sample: "NN-1042" },
      { name: "order_total", description: "Formatted order total.", sample: "£28.00" },
      {
        name: "items_table",
        description: "The receipt table (line items + total).",
        sample: sampleTable,
      },
      {
        name: "order_url",
        description: "Link to the customer's order page.",
        sample: `${site.url}/orders/abc123`,
      },
    ],
  },
  {
    key: "shipping_confirmation",
    label: "Shipping confirmation",
    description: "Sent automatically when the POD provider reports the order shipped.",
    defaultSubject: "On its way — {{order_number}}",
    defaultHeading: "It's shipped.",
    defaultBody: `<p>Your order's on its way.</p>
{{tracking_table}}
{{track_button}}`,
    vars: [
      { name: "order_number", description: "Order number (or short id).", sample: "NN-1042" },
      {
        name: "tracking_table",
        description: "Carrier + tracking number table.",
        sample: sampleTracking,
      },
      {
        name: "tracking_url",
        description: "Raw tracking URL (may be blank).",
        sample: "https://track.example/AB123456789GB",
      },
      {
        name: "track_button",
        description: "Ready-made 'Track your parcel' link (blank if no URL).",
        sample: `<p style="margin-top:20px"><a href="https://track.example" style="color:${ACCENT}">Track your parcel</a></p>`,
      },
    ],
  },
  {
    key: "refund_requested",
    label: "Refund — requested",
    description: "Sent to the customer when they request a refund.",
    defaultSubject: "Refund request received. — {{order_number}}",
    defaultHeading: "Refund request received.",
    defaultBody: `<p>We got your refund request for <strong>{{amount}}</strong>. We'll look at it and follow up.</p>`,
    vars: [
      { name: "order_number", description: "Order number (or short id).", sample: "NN-1042" },
      { name: "amount", description: "Formatted refund amount.", sample: "£28.00" },
    ],
  },
  {
    key: "refund_completed",
    label: "Refund — issued",
    description: "Sent to the customer when a refund has been issued.",
    defaultSubject: "Refund issued. — {{order_number}}",
    defaultHeading: "Refund issued.",
    defaultBody: `<p>We've issued a refund of <strong>{{amount}}</strong>. It usually shows up in your account in a few days.</p>`,
    vars: [
      { name: "order_number", description: "Order number (or short id).", sample: "NN-1042" },
      { name: "amount", description: "Formatted refund amount.", sample: "£28.00" },
    ],
  },
  {
    key: "welcome",
    label: "Account welcome",
    description: "Sent when a customer creates an account.",
    defaultSubject: "Welcome to Nautical Nomads",
    defaultHeading: "Welcome aboard.",
    defaultBody: `<p>Hi {{name}} — welcome aboard.</p>
<p>Your account's set up. We'll save your details so checkout is faster next time, and you can look up old orders any time.</p>
<p><a href="{{shop_url}}" style="color:${ACCENT}">Browse the shop →</a></p>`,
    vars: [
      {
        name: "name",
        description: "Customer's first name (falls back to 'there').",
        sample: "Sam",
      },
      { name: "shop_url", description: "Link to the shop.", sample: `${site.url}/shop` },
    ],
  },
  {
    key: "abandoned_cart",
    label: "Abandoned cart",
    description: "Reminder sent when a cart is left behind.",
    defaultSubject: "Still thinking it over?",
    defaultHeading: "Want me to hold it for you?",
    defaultBody: `<p>You left something in your bag. We saved it for now.</p>
<ul style="padding-left:18px;margin-top:8px">{{items_list}}</ul>
<p style="margin-top:20px"><a href="{{cart_url}}" style="color:${ACCENT}">Come back to your bag →</a></p>
<p style="font-size:12px;color:rgba(42,40,38,0.5);margin-top:30px">Don't want these reminders? <a href="{{unsubscribe_url}}" style="color:rgba(42,40,38,0.5)">Unsubscribe</a>.</p>`,
    vars: [
      {
        name: "items_list",
        description: "The bag's items as <li> rows.",
        sample: `<li style="margin:4px 0">Tide Tee — <span style="font-family:ui-monospace,monospace">£28.00</span></li>`,
      },
      { name: "cart_url", description: "Link back to the cart.", sample: `${site.url}/cart` },
      {
        name: "unsubscribe_url",
        description: "One-click unsubscribe link.",
        sample: `${site.url}/cart/unsubscribe`,
      },
    ],
  },
  {
    key: "newsletter_welcome",
    label: "Newsletter welcome (10% off)",
    description: "Sent when someone subscribes to the newsletter, with their discount code.",
    defaultSubject: "Welcome to Nautical Nomads — 10% off",
    defaultHeading: "Welcome aboard.",
    defaultBody: `<p>Welcome aboard — you're on the list for new arrivals, stories, and the odd quiet offer.</p>
<p>Here's <strong>10% off</strong> your first order:</p>
<p style="margin:20px 0"><span style="display:inline-block;border:1px dashed ${ACCENT};color:${ACCENT};font-family:ui-monospace,monospace;font-size:20px;letter-spacing:2px;padding:12px 20px">{{code}}</span></p>
<p>Use it at checkout. One use per customer.</p>
<p style="margin-top:24px"><a href="{{shop_url}}" style="color:${ACCENT}">Start exploring →</a></p>`,
    vars: [
      { name: "code", description: "The discount code.", sample: "WELCOME10" },
      { name: "shop_url", description: "Link to the shop.", sample: `${site.url}/shop` },
    ],
  },
  {
    key: "owner_alert",
    label: "Owner alert (internal)",
    description: "Sent to the owner on attention-needed events (not to customers).",
    internal: true,
    defaultSubject: "[NN] {{subject}}",
    defaultHeading: "{{subject}}",
    defaultBody: `<pre style="font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap">{{body}}</pre>`,
    vars: [
      { name: "subject", description: "Short alert subject.", sample: "Fulfilment failed" },
      {
        name: "body",
        description: "Alert detail text.",
        sample: "Order NN-1042 could not be placed with Printful.",
      },
    ],
  },
  {
    key: "gift_card_delivered",
    label: "Gift card delivered",
    description: "Sent to the purchaser once a gift card is paid for, with the redeemable code.",
    defaultSubject: "Your {{amount}} Nautical Nomads gift card",
    defaultHeading: "Here's your gift card",
    defaultBody: `<p>Thanks — your gift card is ready to use. Here's the code:</p>
<p style="margin:24px 0;text-align:center">
  <span style="display:inline-block;font-family:ui-monospace,monospace;font-size:22px;letter-spacing:2px;background:#fff;border:1px solid rgba(42,40,38,0.15);border-radius:6px;padding:14px 22px">{{code}}</span>
</p>
<p>Balance: <strong>{{amount}}</strong>. Valid until <strong>{{expiry_date}}</strong>.</p>
<p>Enter the code in the gift card box at checkout — it applies to your whole order, and any unused balance stays on the card.</p>
<p><a href="{{shop_url}}" style="color:${ACCENT}">Browse the shop →</a></p>`,
    vars: [
      { name: "code", description: "The redeemable gift card code.", sample: "NN-AB2C-7K9D-QF3M" },
      { name: "amount", description: "Formatted gift card value.", sample: "£50.00" },
      { name: "expiry_date", description: "When the card expires.", sample: "9 June 2027" },
      { name: "shop_url", description: "Link to the shop.", sample: site.url + "/shop" },
    ],
  },
  {
    key: "store_credit_added",
    label: "Store credit added",
    description:
      "Sent when store credit lands in a customer's account — loyalty reward, referral, or a manual grant.",
    defaultSubject: "You've got {{amount}} in store credit",
    defaultHeading: "Store credit added",
    defaultBody: `<p>Good news — <strong>{{amount}}</strong> of store credit has been added to your account.</p>
<p style="color:rgba(42,40,38,0.6)">{{reason}}</p>
<p>Your balance is now <strong>{{balance}}</strong>. It's applied automatically at checkout — no code needed.</p>
<p style="margin-top:24px"><a href="{{shop_url}}" style="color:${ACCENT}">Spend it →</a> · <a href="{{account_url}}" style="color:${ACCENT}">View your account</a></p>`,
    vars: [
      { name: "amount", description: "Credit just added.", sample: "£5.00" },
      { name: "balance", description: "New total balance.", sample: "£15.00" },
      {
        name: "reason",
        description: "Why it was added (loyalty, referral, etc.).",
        sample: "Loyalty reward",
      },
      { name: "shop_url", description: "Link to the shop.", sample: `${site.url}/shop` },
      {
        name: "account_url",
        description: "Link to the account page.",
        sample: `${site.url}/account`,
      },
    ],
  },
];

const BY_KEY = new Map(EMAIL_TEMPLATES.map((t) => [t.key, t]));

export function getTemplateDef(key: string): EmailTemplateDef | undefined {
  return BY_KEY.get(key);
}

// Replace {{var}} with its value; unknown placeholders are left untouched so a
// typo never silently deletes content.
export function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

type Override = {
  key: string;
  subject: string | null;
  heading: string | null;
  body: string | null;
};

// Load any DB overrides for the given keys. Returns {} if the table doesn't
// exist yet (pre-migration) — callers then use the code defaults.
async function loadOverrides(keys: string[]): Promise<Record<string, Override>> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("email_templates")
      .select("key, subject, heading, body")
      .in("key", keys);
    const map: Record<string, Override> = {};
    for (const r of (data as unknown as Override[]) ?? []) map[r.key] = r;
    return map;
  } catch {
    return {};
  }
}

function resolve(def: EmailTemplateDef, o: Override | undefined) {
  return {
    subject: (o?.subject?.trim() || def.defaultSubject) ?? "",
    heading: (o?.heading?.trim() || def.defaultHeading) ?? "",
    body: o?.body?.trim() || def.defaultBody,
  };
}

export type EmailBranding = { logo_url: string | null; cover_urls: string[] };

// Admin-set logo + cover images for emails (Admin → Emails → Email branding),
// stored in the cms_content key "email.branding". Covers rotate (one picked per
// email). Falls back to defaults so emails keep rendering (text wordmark, no
// cover) before anything is set. Tolerates the legacy single `cover_url` shape.
export async function getEmailBranding(): Promise<EmailBranding> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("cms_content")
      .select("value")
      .eq("key", "email.branding")
      .maybeSingle();
    const v =
      (
        data as unknown as {
          value: { logo_url?: string; cover_urls?: string[]; cover_url?: string };
        } | null
      )?.value ?? {};

    // Manual covers set in admin take precedence; fall back to Drive folder.
    let covers = Array.isArray(v.cover_urls)
      ? v.cover_urls.filter((u): u is string => !!u)
      : v.cover_url
        ? [v.cover_url]
        : [];

    if (covers.length === 0) {
      const driveCovers = await listEmailCoverImages();
      covers = driveCovers.map((f) => driveImageUrl(f.id));
    }

    return { logo_url: v.logo_url ?? null, cover_urls: covers };
  } catch {
    return { logo_url: null, cover_urls: [] };
  }
}

function wrapLayout(
  heading: string,
  body: string,
  layoutBody: string,
  branding: EmailBranding = { logo_url: null, cover_urls: [] },
): string {
  const logo_block = branding.logo_url
    ? `<img src="${branding.logo_url}" alt="${site.name}" height="40" style="display:block;height:40px;width:auto;max-width:260px;border:0" />`
    : `<p style="margin:0;font-size:11px;font-weight:400;letter-spacing:0.45em;text-transform:uppercase;color:#2A2826">${site.name}</p>`;
  const cover = branding.cover_urls.length
    ? branding.cover_urls[Math.floor(Math.random() * branding.cover_urls.length)]
    : null;
  const cover_block = cover
    ? `<tr><td style="padding:20px 24px 0"><img src="${cover}" alt="" width="512" style="display:block;width:100%;height:auto;border:0;border-radius:8px" /></td></tr>`
    : "";
  return interpolate(layoutBody, {
    heading,
    body,
    site_name: site.name,
    site_url: site.url,
    logo_block,
    cover_block,
  });
}

// Render an email to { subject, html }, applying DB overrides + the shared
// layout. Used by lib/email.ts at send time.
export async function renderEmail(
  key: string,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string }> {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown email template: ${key}`);
  const [overrides, branding] = await Promise.all([
    loadOverrides([key, LAYOUT_KEY]),
    getEmailBranding(),
  ]);
  const r = resolve(def, overrides[key]);
  const subject = interpolate(r.subject, vars);
  const heading = interpolate(r.heading, vars);
  const body = interpolate(r.body, vars);
  const layoutBody = resolve(BY_KEY.get(LAYOUT_KEY)!, overrides[LAYOUT_KEY]).body;
  return { subject, html: wrapLayout(heading, body, layoutBody, branding) };
}

export function sampleVarsFor(key: string): Record<string, string> {
  const def = BY_KEY.get(key);
  if (!def) return {};
  return Object.fromEntries(def.vars.map((v) => [v.name, v.sample]));
}

// Render a template with its sample data for previews / test sends.
export async function renderEmailSample(key: string): Promise<{ subject: string; html: string }> {
  return renderEmail(key, sampleVarsFor(key));
}

export type AdminTemplate = {
  def: EmailTemplateDef;
  subject: string;
  heading: string;
  body: string;
  overridden: boolean;
  preview: string; // full HTML rendered with sample data
};

// Everything the admin Emails tab needs, in a single DB round-trip.
export async function getAdminTemplates(): Promise<AdminTemplate[]> {
  const [overrides, branding] = await Promise.all([
    loadOverrides(EMAIL_TEMPLATES.map((t) => t.key)),
    getEmailBranding(),
  ]);
  const layoutBody = resolve(BY_KEY.get(LAYOUT_KEY)!, overrides[LAYOUT_KEY]).body;
  return EMAIL_TEMPLATES.map((def) => {
    const o = overrides[def.key];
    const r = resolve(def, o);
    const sample = sampleVarsFor(def.key);
    const body = interpolate(r.body, sample);
    const heading = interpolate(r.heading, sample);
    const preview =
      def.key === LAYOUT_KEY
        ? wrapLayout("Heading goes here", "<p>Body content goes here.</p>", r.body, branding)
        : wrapLayout(heading, body, layoutBody, branding);
    return {
      def,
      subject: r.subject,
      heading: r.heading,
      body: r.body,
      overridden: !!(o && (o.subject || o.heading || o.body)),
      preview,
    };
  });
}
