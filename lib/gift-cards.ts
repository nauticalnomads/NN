// Gift-card domain logic. All access is server-side via the service client
// (RLS denies anon/auth), so codes and balances never reach the browser except
// where we deliberately return them (to the purchaser on their order page/email).
import { createServiceClient } from "@/lib/supabase/service";
import { sendGiftCardCode } from "@/lib/email";

export const GIFT_CARD_MIN = 10;
export const GIFT_CARD_MAX = 500;
export const GIFT_CARD_PRESETS = [25, 50, 100];
export const GIFT_CARD_VALID_MONTHS = 12;

// Unambiguous charset (no 0/O/1/I/L). 3 blocks of 4 → ~30^12 keyspace.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function codeBlock(n = 4): string {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  let s = "";
  for (let i = 0; i < n; i++) s += CODE_CHARS[a[i] % CODE_CHARS.length];
  return s;
}
export function generateGiftCardCode(): string {
  return `NN-${codeBlock()}-${codeBlock()}-${codeBlock()}`;
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function oneYearFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + GIFT_CARD_VALID_MONTHS);
  return d.toISOString();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type GiftCardRow = {
  id: string;
  code: string;
  balance: number | string;
  initial_amount: number | string;
  currency: string;
  status: string;
  expires_at: string | null;
  purchaser_email: string | null;
};

// Create a `pending` card tied to its purchase order. Activated (and emailed)
// once the order is paid. Retries on the (astronomically unlikely) code clash.
export async function createPendingGiftCard(opts: {
  amount: number;
  currency: string;
  email: string;
  orderId: string;
}): Promise<{ id: string; code: string } | null> {
  const sb = createServiceClient();
  const amount = round2(opts.amount);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGiftCardCode();
    const { data, error } = await sb
      .from("gift_cards")
      .insert({
        code,
        initial_amount: amount,
        balance: amount,
        currency: opts.currency.toUpperCase(),
        status: "pending",
        purchaser_email: opts.email,
        order_id: opts.orderId,
      } as never)
      .select("id, code")
      .single();
    if (!error && data) return data as unknown as { id: string; code: string };
    // 23505 = unique_violation (code clash) — retry; anything else, bail.
    if (error && error.code !== "23505") {
      console.error("createPendingGiftCard failed:", error.message);
      return null;
    }
  }
  return null;
}

// Look up a card that can currently be redeemed against a `currency` order.
export async function getRedeemableCard(
  code: string,
  currency: string,
): Promise<{ id: string; balance: number; currency: string; expires_at: string | null } | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("gift_cards")
    .select("id, balance, currency, status, expires_at")
    .eq("code", normaliseCode(code))
    .maybeSingle();
  const card = data as unknown as GiftCardRow | null;
  if (!card) return null;
  if (card.status !== "active") return null;
  const balance = Number(card.balance);
  if (!(balance > 0)) return null;
  if (card.currency.toUpperCase() !== currency.toUpperCase()) return null;
  if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) return null;

  // Subtract any in-flight (pending) reservations so two concurrent orders
  // can't both reserve the same balance and each receive a Stripe discount for
  // it. Settlement (debitCard, a CAS on balance) is the final backstop.
  const { data: pend } = await sb
    .from("gift_card_redemptions")
    .select("amount")
    .eq("gift_card_id", card.id)
    .eq("status", "pending");
  const reserved = ((pend as unknown as Array<{ amount: number | string }>) ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0,
  );
  const available = round2(balance - reserved);
  if (!(available > 0)) return null;
  return {
    id: card.id,
    balance: available,
    currency: card.currency.toUpperCase(),
    expires_at: card.expires_at,
  };
}

// Safe summary for the checkout UI — never reveals anything but the balance.
export async function previewGiftCard(
  code: string,
  currency: string,
): Promise<{ valid: boolean; balance?: number; currency?: string; message: string }> {
  if (!normaliseCode(code)) return { valid: false, message: "Enter a gift card code." };
  const card = await getRedeemableCard(code, currency);
  if (!card) {
    return { valid: false, message: "That code isn't valid, has expired, or has no balance left." };
  }
  return {
    valid: true,
    balance: card.balance,
    currency: card.currency,
    message: `Gift card balance: applied at checkout.`,
  };
}

// Reserve a redemption against an order (status `pending`). The balance is only
// actually debited when the order is paid (processGiftCardsForOrder).
export async function createPendingRedemption(opts: {
  giftCardId: string;
  orderId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const sb = createServiceClient();
  await sb.from("gift_card_redemptions").insert({
    gift_card_id: opts.giftCardId,
    order_id: opts.orderId,
    amount: round2(opts.amount),
    currency: opts.currency.toUpperCase(),
    status: "pending",
  } as never);
}

// Atomically debit a card. CAS on (status, balance) so concurrent redemptions
// can't double-spend; retries on a lost race.
async function debitCard(cardId: string, amount: number): Promise<boolean> {
  const sb = createServiceClient();
  for (let i = 0; i < 5; i++) {
    const { data } = await sb
      .from("gift_cards")
      .select("balance, status")
      .eq("id", cardId)
      .maybeSingle();
    const card = data as unknown as { balance: number | string; status: string } | null;
    if (!card || card.status !== "active") return false;
    const bal = Number(card.balance);
    if (amount > bal + 1e-9) return false;
    const newBal = round2(bal - amount);
    const { data: upd } = await sb
      .from("gift_cards")
      .update({
        balance: newBal,
        status: newBal <= 0 ? "redeemed" : "active",
        last_redeemed_at: new Date().toISOString(),
      } as never)
      .eq("id", cardId)
      .eq("status", "active")
      .eq("balance", card.balance)
      .select("id");
    if (Array.isArray(upd) && upd.length > 0) return true;
  }
  return false;
}

// Post-payment hook (called from markOrderPaid side effects): activate any
// cards bought in this order (+ email the code), and debit any redemptions
// reserved against it. Idempotent — only acts on `pending` rows.
export async function processGiftCardsForOrder(orderId: string): Promise<void> {
  const sb = createServiceClient();

  // 1) Activate purchased cards.
  const { data: purchased } = await sb
    .from("gift_cards")
    .select("id, code, balance, currency, purchaser_email, status")
    .eq("order_id", orderId)
    .eq("status", "pending");
  for (const c of (purchased as unknown as GiftCardRow[]) ?? []) {
    const expires = oneYearFromNow();
    const { data: upd } = await sb
      .from("gift_cards")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
        expires_at: expires,
      } as never)
      .eq("id", c.id)
      .eq("status", "pending")
      .select("id");
    if (Array.isArray(upd) && upd.length > 0 && c.purchaser_email) {
      await sendGiftCardCode(c.purchaser_email, {
        code: c.code,
        amount: Number(c.balance),
        currency: c.currency,
        expires_at: expires,
      }).catch((e) => console.error("gift card delivery email:", e));
    }
  }

  // 2) Apply reserved redemptions.
  const { data: redemptions } = await sb
    .from("gift_card_redemptions")
    .select("id, gift_card_id, amount, status")
    .eq("order_id", orderId)
    .eq("status", "pending");
  for (const r of (redemptions as unknown as Array<{
    id: string;
    gift_card_id: string;
    amount: number | string;
  }>) ?? []) {
    const ok = await debitCard(r.gift_card_id, Number(r.amount));
    await sb
      .from("gift_card_redemptions")
      .update({
        status: ok ? "applied" : "void",
        applied_at: ok ? new Date().toISOString() : null,
      } as never)
      .eq("id", r.id)
      .eq("status", "pending");
  }
}

// For the order-confirmation page: the card a buyer purchased in this order.
export async function getPurchasedGiftCardForOrder(orderId: string): Promise<{
  code: string;
  balance: number;
  currency: string;
  expires_at: string | null;
  status: string;
} | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("gift_cards")
    .select("code, balance, currency, expires_at, status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const card = data as unknown as GiftCardRow | null;
  if (!card) return null;
  return {
    code: card.code,
    balance: Number(card.balance),
    currency: card.currency,
    expires_at: card.expires_at,
    status: card.status,
  };
}

// Total gift-card credit applied to an order (for the totals breakdown).
export async function getRedeemedCreditForOrder(orderId: string): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("gift_card_redemptions")
    .select("amount, status")
    .eq("order_id", orderId)
    .in("status", ["pending", "applied"]);
  const rows = (data as unknown as Array<{ amount: number | string }>) ?? [];
  return round2(rows.reduce((s, r) => s + Number(r.amount), 0));
}
