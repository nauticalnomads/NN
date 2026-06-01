// Transactional + journey email via Resend. All templates are brand-voice
// (master architecture §9.3): plainspoken, short sentences, no exclamation
// marks, occasional small specific image. No-ops gracefully if Resend isn't
// configured so the rest of the order flow keeps working in dev.
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { site, absoluteUrl } from "@/lib/site";
import { formatPrice } from "@/lib/format";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM || "hello@nautical-nomads.com";

async function send(to: string, subject: string, html: string, text?: string) {
  const r = client();
  if (!r) {
    console.warn("Resend not configured; skipping email", subject, "→", to);
    return null;
  }
  return r.emails.send({ from: FROM, to, subject, html, text });
}

// Common shell — Hull White surface, Deep Ink text, Terracotta accents.
function shell(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;background:#FAF6EC;font-family:-apple-system,BlinkMacSystemFont,Helvetica,sans-serif;color:#2A2826;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EC;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FAF6EC">
        <tr><td style="padding:0 24px">
          <p style="margin:0;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#4A6B85">Nautical Nomads</p>
          <h1 style="margin:14px 0 0;font-size:30px;line-height:1.15;color:#2A2826;font-weight:500">${title}</h1>
          <div style="margin-top:24px;font-size:16px;line-height:1.6;color:#2A2826">${body}</div>
          <hr style="border:none;border-top:1px solid rgba(42,40,38,0.1);margin:40px 0 24px"/>
          <p style="font-size:12px;color:rgba(42,40,38,0.5);margin:0">${site.name} · Live by the tide · ${site.url}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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

  const body = `
    <p>Thanks — your order's in. The full receipt is below.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse">${rows}
      <tr><td colspan="2" style="border-top:1px solid rgba(42,40,38,0.1);padding-top:12px"></td></tr>
      <tr><td style="padding:6px 0;font-size:14px"><strong>Total</strong></td><td align="right" style="padding:6px 0;font-family:ui-monospace,monospace"><strong>${formatPrice(order.grand_total, order.currency)}</strong></td></tr>
    </table>
    <p style="margin-top:24px">We'll send tracking the moment it ships.</p>
    <p><a href="${absoluteUrl(`/orders/${order.id}`)}" style="color:#C75D3E">View your order</a></p>
  `;
  return send(
    order.email,
    `Order received — ${order.order_number ?? order.id.slice(0, 8)}`,
    shell("Thanks — that's in.", body),
  );
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
  const body = `
    <p>Your order's on its way.</p>
    <table cellpadding="0" cellspacing="0" style="margin-top:16px">
      ${tracking.carrier ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;color:rgba(42,40,38,0.5);text-transform:uppercase;letter-spacing:1px">Carrier</td><td style="font-family:ui-monospace,monospace;font-size:14px">${tracking.carrier}</td></tr>` : ""}
      ${tracking.number ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;color:rgba(42,40,38,0.5);text-transform:uppercase;letter-spacing:1px">Tracking</td><td style="font-family:ui-monospace,monospace;font-size:14px">${tracking.number}</td></tr>` : ""}
    </table>
    ${tracking.url ? `<p style="margin-top:20px"><a href="${tracking.url}" style="color:#C75D3E">Track your parcel</a></p>` : ""}
  `;
  return send(
    order.email,
    `On its way — ${order.order_number ?? orderId.slice(0, 8)}`,
    shell("It's shipped.", body),
  );
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
  const title = status === "completed" ? "Refund issued." : "Refund request received.";
  const body =
    status === "completed"
      ? `<p>We've issued a refund of <strong>${formatPrice(amount, currency)}</strong>. It usually shows up in your account in a few days.</p>`
      : `<p>We got your refund request for <strong>${formatPrice(amount, currency)}</strong>. We'll look at it and follow up.</p>`;
  return send(
    order.email,
    `${title} — ${order.order_number ?? orderId.slice(0, 8)}`,
    shell(title, body),
  );
}

// ── WELCOME (account signup) ─────────────────────────────────────────────────
export async function sendWelcome(email: string, name?: string) {
  const body = `<p>Hi${name ? ` ${name}` : ""} — welcome aboard.</p>
  <p>Your account's set up. We'll save your details so checkout is faster next time, and you can look up old orders any time.</p>
  <p><a href="${absoluteUrl("/shop")}" style="color:#C75D3E">Browse the shop →</a></p>`;
  return send(email, "Welcome to Nautical Nomads", shell("Welcome aboard.", body));
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
  const body = `<p>You left something in your bag. We saved it for now.</p>
  <ul style="padding-left:18px;margin-top:8px">${list}</ul>
  <p style="margin-top:20px"><a href="${absoluteUrl("/cart")}" style="color:#C75D3E">Come back to your bag →</a></p>
  <p style="font-size:12px;color:rgba(42,40,38,0.5);margin-top:30px">Don't want these reminders? <a href="${absoluteUrl(`/cart/unsubscribe?email=${encodeURIComponent(email)}`)}" style="color:rgba(42,40,38,0.5)">Unsubscribe</a>.</p>`;
  return send(email, "Still thinking it over?", shell("Want me to hold it for you?", body));
}

// ── OWNER ATTENTION-NEEDED ───────────────────────────────────────────────────
export async function sendOwnerAlert(subject: string, body: string) {
  const to = process.env.OWNER_ALERT_EMAIL;
  if (!to) return;
  return send(
    to,
    `[NN] ${subject}`,
    shell(
      subject,
      `<pre style="font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap">${body}</pre>`,
    ),
  );
}

// ── NEWSLETTER WELCOME / 10% OFF (redesign v2 §3.5) ──────────────────────────
export async function sendNewsletterWelcome(email: string, code: string) {
  const body = `
    <p>Welcome aboard — you're on the list for new arrivals, stories, and the odd quiet offer.</p>
    <p>Here's <strong>10% off</strong> your first order:</p>
    <p style="margin:20px 0">
      <span style="display:inline-block;border:1px dashed #C75D3E;color:#C75D3E;font-family:ui-monospace,monospace;font-size:20px;letter-spacing:2px;padding:12px 20px">${code}</span>
    </p>
    <p>Use it at checkout. One use per customer.</p>
    <p style="margin-top:24px"><a href="${absoluteUrl("/shop")}" style="color:#C75D3E">Start exploring →</a></p>`;
  return send(email, "Welcome to Nautical Nomads — 10% off", shell("Welcome aboard.", body));
}
