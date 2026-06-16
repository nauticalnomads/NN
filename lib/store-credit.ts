// Account-based loyalty: store-credit ledger + referrals. All access is
// service-role only (RLS denies anon/auth), so balances never reach the browser
// except where this module deliberately returns them to the signed-in owner
// (their account page) or to the order/email flow.
//
// Balance model (mirrors gift cards): a customer's *available* credit is the
// sum of `applied` ledger rows. Redemptions are reserved as `pending` at
// checkout and only debit the balance — flip to `applied` — when the order is
// paid (applyReservedCredit), capped to whatever is genuinely available at that
// moment so two concurrent checkouts can't overspend. Earns are `applied`
// immediately and made idempotent per (order, reason) by a unique index.
import { createServiceClient } from "@/lib/supabase/service";
import { sendStoreCreditAdded } from "@/lib/email";

// Loyalty: percentage of net merchandise spend (cash paid toward goods,
// excluding shipping and any credit-funded portion) returned as store credit.
export const LOYALTY_EARN_PERCENT = 5;
// Referral: flat credit to BOTH parties when a referred customer's first order
// is paid.
export const REFERRAL_REWARD = 10;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Unambiguous charset (no 0/O/1/I/L), matching the gift-card code style.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function referralCode(): string {
  const a = new Uint32Array(6);
  crypto.getRandomValues(a);
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[a[i] % CODE_CHARS.length];
  return s;
}

export function normaliseReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

type LedgerRow = {
  id: string;
  amount: number | string;
  currency: string;
  reason: string;
  status: string;
  note: string | null;
  created_at: string;
};

// A customer's spendable balance in `currency` = sum of `applied` rows. Returns
// 0 (never throws) so callers/UI degrade gracefully before the migration runs.
export async function getAvailableCredit(customerId: string, currency = "GBP"): Promise<number> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("store_credit_transactions")
      .select("amount, currency, status")
      .eq("customer_id", customerId)
      .eq("status", "applied");
    const rows = (data as unknown as Array<{ amount: number | string; currency: string }>) ?? [];
    const cur = currency.toUpperCase();
    const bal = rows
      .filter((r) => r.currency.toUpperCase() === cur)
      .reduce((s, r) => s + Number(r.amount), 0);
    return round2(Math.max(0, bal));
  } catch {
    return 0;
  }
}

// The customer's ledger for the account page (most recent first).
export async function getCreditLedger(
  customerId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    amount: number;
    currency: string;
    reason: string;
    note: string | null;
    created_at: string;
  }>
> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("store_credit_transactions")
      .select("id, amount, currency, reason, status, note, created_at")
      .eq("customer_id", customerId)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = (data as unknown as LedgerRow[]) ?? [];
    return rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      reason: r.reason,
      note: r.note,
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

// Human label for a ledger reason (account page + emails).
export function reasonLabel(reason: string): string {
  switch (reason) {
    case "loyalty_earn":
      return "Loyalty reward";
    case "referral_referrer":
      return "Referral reward — a friend ordered";
    case "referral_referee":
      return "Welcome referral credit";
    case "admin_grant":
      return "Credit from Nautical Nomads";
    case "redemption":
      return "Applied to an order";
    case "reversal":
      return "Adjustment";
    default:
      return reason.replace(/_/g, " ");
  }
}

// Insert a positive (earned/granted) credit row. Order-driven grants are
// idempotent via the unique (order_id, reason) index — a duplicate is swallowed
// (23505) so the post-payment hook is safe to re-run. Optionally emails the
// customer that credit landed. Returns true if a new row was written.
export async function grantCredit(opts: {
  customerId: string;
  amount: number;
  reason: string;
  currency?: string;
  orderId?: string | null;
  note?: string | null;
  notifyEmail?: string | null;
}): Promise<boolean> {
  const amount = round2(opts.amount);
  if (!(amount > 0)) return false;
  const currency = (opts.currency ?? "GBP").toUpperCase();
  const sb = createServiceClient();
  const { error } = await sb.from("store_credit_transactions").insert({
    customer_id: opts.customerId,
    amount,
    currency,
    reason: opts.reason,
    status: "applied",
    order_id: opts.orderId ?? null,
    note: opts.note ?? null,
    applied_at: new Date().toISOString(),
  } as never);
  if (error) {
    // 23505 = unique_violation → already granted for this (order, reason).
    if (error.code !== "23505") console.error("grantCredit failed:", error.message);
    return false;
  }
  if (opts.notifyEmail) {
    const balance = await getAvailableCredit(opts.customerId, currency);
    sendStoreCreditAdded(opts.notifyEmail, {
      amount,
      currency,
      balance,
      reason: opts.reason,
    }).catch((e) => console.error("store credit email:", e));
  }
  return true;
}

// Reserve a redemption against an order (negative, `pending`). Capped to the
// currently-available balance. Returns the amount actually reserved.
export async function reserveCredit(opts: {
  customerId: string;
  orderId: string;
  amount: number;
  currency?: string;
}): Promise<number> {
  const currency = (opts.currency ?? "GBP").toUpperCase();
  const sb = createServiceClient();
  // Net available = applied balance + already-pending reservations (which are
  // stored negative), summed signed. Counting existing pending reservations
  // here stops two concurrent checkouts from each reserving — and each
  // receiving a Stripe discount for — the same balance. Settlement
  // (applyReservedCredit) re-caps to the real balance as the final backstop.
  const { data: bal } = await sb
    .from("store_credit_transactions")
    .select("amount")
    .eq("customer_id", opts.customerId)
    .eq("currency", currency)
    .in("status", ["applied", "pending"]);
  const net = round2(
    ((bal as unknown as Array<{ amount: number | string }>) ?? []).reduce(
      (s, r) => s + Number(r.amount),
      0,
    ),
  );
  const redeem = round2(Math.min(opts.amount, Math.max(0, net)));
  if (!(redeem > 0)) return 0;
  const { error } = await sb.from("store_credit_transactions").insert({
    customer_id: opts.customerId,
    amount: -redeem,
    currency,
    reason: "redemption",
    status: "pending",
    order_id: opts.orderId,
  } as never);
  if (error) {
    // 23505 → a redemption was already reserved for this order (retry/double
    // submit). Treat as no new reservation.
    if (error.code !== "23505") console.error("reserveCredit failed:", error.message);
    return 0;
  }
  return redeem;
}

// Post-payment: turn any `pending` redemptions on this order into `applied`,
// capped to the balance available right now (so an over-reservation across two
// concurrent checkouts can't overspend — the shortfall is voided). Idempotent.
export async function applyReservedCredit(orderId: string): Promise<void> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("store_credit_transactions")
    .select("id, customer_id, amount, currency, status")
    .eq("order_id", orderId)
    .eq("reason", "redemption")
    .eq("status", "pending");
  const rows =
    (data as unknown as Array<{
      id: string;
      customer_id: string;
      amount: number | string;
      currency: string;
    }>) ?? [];
  for (const r of rows) {
    const want = Math.abs(Number(r.amount));
    const available = await getAvailableCredit(r.customer_id, r.currency);
    const apply = round2(Math.min(want, available));
    if (apply <= 0) {
      await sb
        .from("store_credit_transactions")
        .update({ status: "void" } as never)
        .eq("id", r.id)
        .eq("status", "pending");
      continue;
    }
    await sb
      .from("store_credit_transactions")
      .update({
        amount: -apply,
        status: "applied",
        applied_at: new Date().toISOString(),
      } as never)
      .eq("id", r.id)
      .eq("status", "pending");
  }
}

// Total store credit applied to an order (reserved or settled) — for totals.
export async function getCreditAppliedToOrder(orderId: string): Promise<number> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("store_credit_transactions")
      .select("amount, status")
      .eq("order_id", orderId)
      .eq("reason", "redemption")
      .in("status", ["pending", "applied"]);
    const rows = (data as unknown as Array<{ amount: number | string }>) ?? [];
    return round2(rows.reduce((s, r) => s + Math.abs(Number(r.amount)), 0));
  } catch {
    return 0;
  }
}

type CustomerLite = {
  id: string;
  email: string;
  referral_code: string | null;
  referred_by: string | null;
};

// Return a customer's referral code, generating + persisting one on first use
// (legacy rows created before this feature have none). Retries on code clash.
export async function ensureReferralCode(customer: {
  id: string;
  referral_code?: string | null;
}): Promise<string | null> {
  if (customer.referral_code) return customer.referral_code;
  const sb = createServiceClient();
  for (let i = 0; i < 5; i++) {
    const code = referralCode();
    const { data, error } = await sb
      .from("customers")
      .update({ referral_code: code } as never)
      .eq("id", customer.id)
      .is("referral_code", null)
      .select("referral_code")
      .maybeSingle();
    if (!error && data) return (data as unknown as { referral_code: string }).referral_code;
    if (error && error.code === "23505") continue; // clash → new code
    // Someone set it concurrently, or another error: re-read.
    const { data: cur } = await sb
      .from("customers")
      .select("referral_code")
      .eq("id", customer.id)
      .maybeSingle();
    const existing = (cur as unknown as { referral_code: string | null } | null)?.referral_code;
    if (existing) return existing;
  }
  return null;
}

// Link a newly-created customer to whoever referred them (one-time, never self,
// never overwrite). `code` is the referrer's referral_code. No-op on any miss.
export async function linkReferral(newCustomerId: string, code: string): Promise<void> {
  const norm = normaliseReferralCode(code);
  if (!norm) return;
  const sb = createServiceClient();
  const { data: referrer } = await sb
    .from("customers")
    .select("id")
    .eq("referral_code", norm)
    .maybeSingle();
  const referrerId = (referrer as unknown as { id: string } | null)?.id;
  if (!referrerId || referrerId === newCustomerId) return;
  await sb
    .from("customers")
    .update({ referred_by: referrerId } as never)
    .eq("id", newCustomerId)
    .is("referred_by", null);
}

// Post-payment hook (from markOrderPaid side effects): settle reserved credit,
// award loyalty credit on the net cash spend, and — on a referred customer's
// FIRST paid order — reward both the referee and the referrer. All movements
// are idempotent, so this is safe to re-run. No-op for guest orders.
export async function processStoreCreditForOrder(orderId: string): Promise<void> {
  // 1) Settle any reserved redemption.
  await applyReservedCredit(orderId);

  const sb = createServiceClient();
  const { data: orderData } = await sb
    .from("orders")
    .select("id, customer_id, currency, subtotal, shipping_total, grand_total")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as {
    customer_id: string | null;
    currency: string;
    grand_total: number | string;
    shipping_total: number | string;
  } | null;
  if (!order || !order.customer_id) return; // guests don't earn (account-based)

  const { data: custData } = await sb
    .from("customers")
    .select("id, email, referral_code, referred_by")
    .eq("id", order.customer_id)
    .maybeSingle();
  const customer = custData as unknown as CustomerLite | null;
  if (!customer) return;

  // 2) Loyalty: earn on net cash paid toward merchandise (grand_total less
  // shipping, clamped ≥ 0). Paying entirely with credit earns nothing, so
  // credit can't be farmed by churning it.
  const merchandiseCash = Math.max(
    0,
    round2(Number(order.grand_total) - Number(order.shipping_total)),
  );
  const earn = round2((merchandiseCash * LOYALTY_EARN_PERCENT) / 100);
  if (earn > 0) {
    await grantCredit({
      customerId: customer.id,
      amount: earn,
      reason: "loyalty_earn",
      currency: order.currency,
      orderId,
      note: `${LOYALTY_EARN_PERCENT}% back on this order`,
      notifyEmail: customer.email,
    });
  }

  // 3) Referral: only on the referred customer's first paid order, and only
  // once ever (guarded by an existing referral_referee row for them).
  if (customer.referred_by) {
    const { data: already } = await sb
      .from("store_credit_transactions")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("reason", "referral_referee")
      .limit(1);
    const alreadyRewarded = Array.isArray(already) && already.length > 0;
    if (!alreadyRewarded) {
      await grantCredit({
        customerId: customer.id,
        amount: REFERRAL_REWARD,
        reason: "referral_referee",
        currency: order.currency,
        orderId,
        note: "Thanks for joining via a friend",
        notifyEmail: customer.email,
      });
      // Reward the referrer too.
      const { data: refData } = await sb
        .from("customers")
        .select("id, email")
        .eq("id", customer.referred_by)
        .maybeSingle();
      const referrer = refData as unknown as { id: string; email: string } | null;
      if (referrer) {
        await grantCredit({
          customerId: referrer.id,
          amount: REFERRAL_REWARD,
          reason: "referral_referrer",
          currency: order.currency,
          orderId,
          note: "A friend you referred placed their first order",
          notifyEmail: referrer.email,
        });
      }
    }
  }
}
