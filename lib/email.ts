// Transactional + journey email via Resend. Brand-voice copy + layout now live
// in editable templates (admin → Emails / lib/email-templates.ts); this module
// fetches the data each email needs, builds the template variables, renders via
// the registry, and sends. No-ops gracefully if Resend isn't configured so the
// rest of the order flow keeps working in dev.
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { absoluteUrl } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import { renderEmail, sampleVarsFor } from "@/lib/email-templates";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM || "info@nauticalnomads.com";

async function send(to: string, subject: string, html: string, text?: string) {
  const r = client();
  if (!r) {
    console.warn("Resend not configured; skipping email", subject, "→", to);
    return null;
  }
  return r.emails.send({ from: FROM, to, subject, html, text });
}

// Render a template by key (applies admin overrides + layout) and send it.
async function sendTemplate(key: string, to: string, vars: Record<string, string>) {
  const { subject, html } = await renderEmail(key, vars);
  return send(to, subject, html);
}

// Send a template with sample data — used by the admin "Send test" button.
export async function sendTemplateTest(key: string, to: string) {
  const { subject, html } = await renderEmail(key, sampleVarsFor(key));
  return send(to, `[TEST] ${subject}`, html);
}

// ── ORDER CONFIRMATION (customer) ────────────────────────────────────────────
export async function sendOrderConfirmation(orderId: string) {
  const sb = createServiceClient();
  const { data: o } = await sb
    .from("orders")
    .select("id, email, grand_total, currency, shipping_address, order_number")
    .eq("id", orderId)
    .maybeSingle();
  const order = o as unknown as {
    id: string;
    email: string;
    grand_total: number;
    currency: string;
    shipping_address: Record<string, string> | null;
    order_number: string | null;
  } | null;
  if (!order) return;

  const { data: itemsData } = await sb
    .from("order_items")
    .select("title, variant_title, quantity, unit_price, currency")
    .eq("order_id", orderId);
  const items =
    (itemsData as unknown as Array<{
      title: string;
      variant_title: string | null;
      quantity: number;
      unit_price: number;
      currency: string;
    }>) || [];

  const rows = items
    .map(
      (
        i,
      ) => `<tr><td style="padding:8px 0;font-size:14px">${i.title}${i.variant_title ? ` <span style="color:rgba(42,40,38,0.5)">· ${i.variant_title}</span>` : ""} × ${i.quantity}</td>
    <td align="right" style="padding:8px 0;font-size:14px;font-family:ui-monospace,monospace">${formatPrice(i.unit_price * i.quantity, i.currency)}</td></tr>`,
    )
    .join("");

  const total = formatPrice(order.grand_total, order.currency);
  const itemsTable = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse">${rows}
      <tr><td colspan="2" style="border-top:1px solid rgba(42,40,38,0.1);padding-top:12px"></td></tr>
      <tr><td style="padding:6px 0;font-size:14px"><strong>Total</strong></td><td align="right" style="padding:6px 0;font-family:ui-monospace,monospace"><strong>${total}</strong></td></tr>
    </table>`;

  return sendTemplate("order_confirmation", order.email, {
    order_number: order.order_number ?? order.id.slice(0, 8),
    order_total: total,
    items_table: itemsTable,
    order_url: absoluteUrl(`/orders/${order.id}`),
  });
}

// ── SHIPPING CONFIRMATION (customer, auto from POD webhook) ──────────────────
export async function sendShippingConfirmation(
  orderId: string,
  tracking: { carrier?: string; number?: string; url?: string },
) {
  const sb = createServiceClient();
  const { data: o } = await sb
    .from("orders")
    .select("email, order_number")
    .eq("id", orderId)
    .maybeSingle();
  const order = o as unknown as { email: string; order_number: string | null } | null;
  if (!order) return;

  const trackingTable = `<table cellpadding="0" cellspacing="0" style="margin-top:16px">
      ${tracking.carrier ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;color:rgba(42,40,38,0.5);text-transform:uppercase;letter-spacing:1px">Carrier</td><td style="font-family:ui-monospace,monospace;font-size:14px">${tracking.carrier}</td></tr>` : ""}
      ${tracking.number ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;color:rgba(42,40,38,0.5);text-transform:uppercase;letter-spacing:1px">Tracking</td><td style="font-family:ui-monospace,monospace;font-size:14px">${tracking.number}</td></tr>` : ""}
    </table>`;
  const trackButton = tracking.url
    ? `<p style="margin-top:20px"><a href="${tracking.url}" style="color:#C75D3E">Track your parcel</a></p>`
    : "";

  return sendTemplate("shipping_confirmation", order.email, {
    order_number: order.order_number ?? orderId.slice(0, 8),
    tracking_table: trackingTable,
    tracking_url: tracking.url ?? "",
    track_button: trackButton,
  });
}

// ── REFUND ───────────────────────────────────────────────────────────────────
export async function sendRefundUpdate(
  orderId: string,
  status: "requested" | "completed",
  amount: number,
  currency: string,
) {
  const sb = createServiceClient();
  const { data: o } = await sb
    .from("orders")
    .select("email, order_number")
    .eq("id", orderId)
    .maybeSingle();
  const order = o as unknown as { email: string; order_number: string | null } | null;
  if (!order) return;
  return sendTemplate(
    status === "completed" ? "refund_completed" : "refund_requested",
    order.email,
    {
      order_number: order.order_number ?? orderId.slice(0, 8),
      amount: formatPrice(amount, currency),
    },
  );
}

// ── WELCOME (account signup) ─────────────────────────────────────────────────
export async function sendWelcome(email: string, name?: string) {
  return sendTemplate("welcome", email, {
    name: name?.trim() || "there",
    shop_url: absoluteUrl("/shop"),
  });
}

// ── ABANDONED CART ───────────────────────────────────────────────────────────
export async function sendAbandonedCart(
  email: string,
  items: { title: string; price: number; currency: string }[],
) {
  const list = items
    .map(
      (i) =>
        `<li style="margin:4px 0">${i.title} — <span style="font-family:ui-monospace,monospace">${formatPrice(i.price, i.currency)}</span></li>`,
    )
    .join("");
  return sendTemplate("abandoned_cart", email, {
    items_list: list,
    cart_url: absoluteUrl("/cart"),
    unsubscribe_url: absoluteUrl(`/cart/unsubscribe?email=${encodeURIComponent(email)}`),
  });
}

// ── OWNER ATTENTION-NEEDED ───────────────────────────────────────────────────
export async function sendOwnerAlert(subject: string, body: string) {
  const to = process.env.OWNER_ALERT_EMAIL;
  if (!to) return;
  return sendTemplate("owner_alert", to, { subject, body });
}

// ── NEWSLETTER WELCOME / 10% OFF (redesign v2 §3.5) ──────────────────────────
export async function sendNewsletterWelcome(email: string, code: string) {
  return sendTemplate("newsletter_welcome", email, {
    code,
    shop_url: absoluteUrl("/shop"),
  });
}

// ── GIFT CARD DELIVERY (to purchaser, after payment) ─────────────────────────
export async function sendGiftCardCode(
  to: string,
  card: { code: string; amount: number; currency: string; expires_at: string },
) {
  const expiry = new Date(card.expires_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return sendTemplate("gift_card_delivered", to, {
    code: card.code,
    amount: formatPrice(card.amount, card.currency),
    expiry_date: expiry,
    shop_url: absoluteUrl("/shop"),
  });
}
