"use server";

import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { quoteShipping, type ShippingAddress, type CartLine } from "@/lib/shipping";
import type { CartItem } from "@/components/cart/CartProvider";
import { absoluteUrl } from "@/lib/site";
import { getCustomer } from "@/lib/customer";
import { markOrderPaid } from "@/lib/orders";
import { getRedeemableCard, createPendingRedemption } from "@/lib/gift-cards";
import { getAvailableCredit, reserveCredit } from "@/lib/store-credit";
import { getPromoPercent } from "@/lib/promo";
import { qualifiesForFreeShipping } from "@/lib/shipping-config";

type Payload = {
  email: string;
  shipping_address: ShippingAddress;
  items: CartItem[];
  giftCardCode?: string;
  promoCode?: string;
  useStoreCredit?: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function createCheckoutSession(
  payload: Payload,
): Promise<{ url?: string; error?: string }> {
  const { email, shipping_address, items, giftCardCode, promoCode, useStoreCredit } = payload;
  if (!email || !items.length) return { error: "Missing email or items." };

  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Payments are not configured yet (STRIPE_SECRET_KEY missing)." };
  }

  const sb = createServiceClient();
  // Enrich cart lines with provider mapping (for shipping + fulfilment) AND the
  // authoritative price/currency. Money is NEVER trusted from the client cart —
  // a tampered client could otherwise set any price. `provider`/`price`/
  // `currency` live on products; per-variant `price`/`provider_variant_id` live
  // on variants. One join, one round-trip.
  const variantIds = items.map((i) => i.variantId);
  const { data: variantRows } = await sb
    .from("variants")
    .select(
      "id, price, provider_variant_id, products(provider, provider_product_id, price, currency)",
    )
    .in("id", variantIds);
  type V = {
    id: string;
    price: number | null;
    provider_variant_id: string | null;
    products: {
      provider: CartLine["provider"];
      provider_product_id: string | null;
      price: number | null;
      currency: string | null;
    } | null;
  };
  const byId = new Map<string, V>(((variantRows as unknown as V[]) ?? []).map((v) => [v.id, v]));
  const enrich = (variantId: string) => {
    const v = byId.get(variantId);
    return {
      provider: v?.products?.provider ?? null,
      provider_product_id: v?.products?.provider_product_id ?? null,
      provider_variant_id: v?.provider_variant_id ?? null,
    };
  };
  // Server-authoritative unit price (variant overrides product) + currency.
  const priced = (variantId: string): { price: number; currency: string } | null => {
    const v = byId.get(variantId);
    if (!v) return null;
    const price = v.price ?? v.products?.price ?? null;
    if (price == null || !Number.isFinite(Number(price))) return null;
    return { price: Number(price), currency: (v.products?.currency ?? "GBP").toUpperCase() };
  };

  // Every cart item must still exist + be priced, and the whole cart must be a
  // single currency (Stripe sessions + our totals are single-currency).
  const serverLines: { item: CartItem; price: number; currency: string }[] = [];
  for (const i of items) {
    const p = priced(i.variantId);
    if (!p) return { error: "An item in your bag is no longer available. Please review your bag." };
    serverLines.push({ item: i, price: p.price, currency: p.currency });
  }
  const currencies = new Set(serverLines.map((l) => l.currency));
  if (currencies.size > 1) {
    return { error: "Your bag mixes currencies. Please check out those items separately." };
  }
  const currencyUpper = serverLines[0].currency;
  const currency = currencyUpper.toLowerCase();
  const subtotal = serverLines.reduce((s, l) => s + l.price * l.item.quantity, 0);
  // variantId → server unit price, for the snapshot + Stripe line items.
  const priceByVariant = new Map(serverLines.map((l) => [l.item.variantId, l.price]));
  const unitPrice = (variantId: string) => priceByVariant.get(variantId) ?? 0;

  const cartLines: CartLine[] = items.map((i) => ({
    ...enrich(i.variantId),
    quantity: i.quantity,
  }));

  const shipping = await quoteShipping(cartLines, shipping_address);

  // Free-shipping threshold: waive the quoted rate once the (pre-discount) items
  // subtotal clears the configured threshold. Off entirely when the env var is
  // unset, so this is a no-op until the store opts in. Mutating the quote keeps
  // the waiver in the order's shipping_quote snapshot and the Stripe shipping
  // option in sync.
  if (qualifiesForFreeShipping(subtotal)) {
    shipping.rate = 0;
    shipping.zone = "Free";
  }

  // Promo code (optional): percent off the items subtotal, validated
  // server-side against lib/promo.ts (never trusted from the client).
  let promoAmount = 0;
  if (promoCode && promoCode.trim()) {
    const pct = await getPromoPercent(promoCode);
    if (pct) promoAmount = round2((subtotal * pct) / 100);
  }
  const discountedSubtotal = round2(subtotal - promoAmount);
  const grossTotal = round2(discountedSubtotal + shipping.rate); // owed after promo

  // Link to the signed-in customer if there is one (guest checkout otherwise).
  const customer = await getCustomer();

  // Credit instruments stack after the promo. A gift card and account store
  // credit are both cash-like: each can pay for the WHOLE order (incl. shipping)
  // — in which case Stripe is skipped — but on the Stripe path they're applied
  // via a one-off `amount_off` coupon which only discounts LINE ITEMS, so the
  // combined credit used there is capped at the discounted items subtotal
  // (shipping is always charged on Stripe). Gift card is spent before store
  // credit, then loyalty earn is computed on the remaining cash.
  let giftCardId: string | null = null;
  let giftBalance = 0;
  if (giftCardCode && giftCardCode.trim()) {
    const card = await getRedeemableCard(giftCardCode, currencyUpper);
    if (card) {
      giftCardId = card.id;
      giftBalance = card.balance;
    }
  }
  // Store credit is account-based and opt-in (a checkbox), signed-in only.
  let storeCreditAvailable = 0;
  if (customer && useStoreCredit) {
    storeCreditAvailable = await getAvailableCredit(customer.id, currencyUpper);
  }

  const creditPool = round2(giftBalance + storeCreditAvailable);
  const fullyCovered = creditPool >= grossTotal;
  const creditToUse = fullyCovered ? grossTotal : round2(Math.min(creditPool, discountedSubtotal));
  // Allocate: gift card first, then store credit.
  const giftRedeem = round2(Math.min(giftBalance, creditToUse));
  const storeCreditRedeem = round2(creditToUse - giftRedeem);

  const discountTotal = round2(promoAmount + creditToUse);
  const grandTotal = round2(subtotal + shipping.rate - discountTotal);

  const orderRow = {
    email,
    customer_id: customer?.id ?? null,
    status: "pending" as const,
    currency: currency.toUpperCase(),
    subtotal,
    shipping_total: shipping.rate,
    tax_total: 0,
    discount_total: discountTotal,
    grand_total: grandTotal,
    shipping_address,
    shipping_quote: shipping,
    shipping_mode: shipping.mode,
  };

  const { data: order, error: orderErr } = await sb
    .from("orders")
    .insert(orderRow as never)
    .select("id")
    .single();
  if (orderErr || !order) {
    console.error("order pre-create failed:", orderErr?.message);
    return { error: "Couldn't open a checkout session. Try again." };
  }
  const orderId = (order as unknown as { id: string }).id;

  // Snapshot the line items NOW (immutable, master §4 golden rule). Includes
  // provider + per-line provider IDs so fulfilment can dispatch from the
  // snapshot alone, never re-reading live product data.
  const itemRows = items.map((i) => {
    const e = enrich(i.variantId);
    return {
      order_id: orderId,
      product_id: i.productId,
      variant_id: i.variantId,
      title: i.title,
      variant_title: i.variantTitle,
      sku: i.sku,
      provider: e.provider,
      provider_product_id: e.provider_product_id,
      provider_variant_id: e.provider_variant_id,
      unit_price: unitPrice(i.variantId),
      quantity: i.quantity,
      currency: currencyUpper,
    };
  });
  await sb.from("order_items").insert(itemRows as never);

  // Reserve the credit redemptions (debited on payment).
  if (giftCardId && giftRedeem > 0) {
    await createPendingRedemption({
      giftCardId,
      orderId,
      amount: giftRedeem,
      currency: currencyUpper,
    });
  }
  if (customer && storeCreditRedeem > 0) {
    await reserveCredit({
      customerId: customer.id,
      orderId,
      amount: storeCreditRedeem,
      currency: currencyUpper,
    });
  }
  // If credit covers the whole order, finalise now without a Stripe payment —
  // markOrderPaid fires the side effects (debits the card + store credit, sends
  // the receipt, runs fulfilment) and we skip Stripe.
  if (creditToUse > 0) {
    if (grandTotal <= 0) {
      await markOrderPaid(orderId, null);
      return { url: absoluteUrl(`/orders/${orderId}`) };
    }
  }

  // Build Stripe line items + flat shipping option.
  const stripe = getStripe();
  const lineItems = items.map((i) => {
    // Stripe rejects the whole session if any image isn't a valid absolute
    // http(s) URL (relative paths, blank strings, or data: URIs all throw).
    // Many catalogue items were imported from Printful/Printify, so guard it.
    const image = safeImageUrl(i.imageUrl);
    return {
      quantity: i.quantity,
      price_data: {
        currency,
        unit_amount: Math.round(unitPrice(i.variantId) * 100),
        product_data: {
          name: i.variantTitle ? `${i.title} — ${i.variantTitle}` : i.title,
          ...(image ? { images: [image] } : {}),
          metadata: { sku: i.sku, variant_id: i.variantId, product_id: i.productId },
        },
      },
    };
  });

  // Promo + partial gift card → ONE one-off Stripe coupon (Checkout allows a
  // single discount). amount_off only ever discounts line items, and we capped
  // promo + gift redemption at the items subtotal above, so the charged total
  // is exactly grandTotal (= subtotal − discounts + shipping).
  const stripeDiscount = round2(promoAmount + creditToUse);
  let discounts: { coupon: string }[] | undefined;
  if (stripeDiscount > 0) {
    const couponName =
      promoAmount > 0 && creditToUse > 0
        ? "Discount + credit"
        : creditToUse > 0
          ? "Credit"
          : "Discount";
    const coupon = await stripe.coupons.create({
      amount_off: Math.round(stripeDiscount * 100),
      currency,
      duration: "once",
      name: couponName,
    });
    discounts = [{ coupon: coupon.id }];
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      ...(discounts ? { discounts } : {}),
      shipping_address_collection: {
        allowed_countries: [
          "GB",
          "IE",
          "FR",
          "DE",
          "ES",
          "IT",
          "NL",
          "BE",
          "PT",
          "SE",
          "DK",
          "PL",
          "AT",
          "US",
          "CA",
          "AU",
          "NZ",
        ],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: Math.round(shipping.rate * 100), currency },
            display_name: `${shipping.zone} shipping`,
          },
        },
      ],
      success_url: absoluteUrl(`/orders/${orderId}?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: absoluteUrl("/cart"),
      payment_intent_data: {
        // Stored on the PaymentIntent so the webhook can correlate back without
        // a Stripe → Supabase query roundtrip.
        metadata: { order_id: orderId },
      },
      metadata: { order_id: orderId },
    });
  } catch (e) {
    // Never let a Stripe rejection bubble up as an opaque "Server Components
    // render" digest — log the real reason (visible in Cloudflare logs) and
    // hand the shopper a concrete message.
    const message = e instanceof Error ? e.message : String(e);
    console.error("stripe.checkout.sessions.create failed:", message);
    return { error: `Payment provider error: ${message}` };
  }

  // Save the Stripe session id for reconciliation.
  await sb
    .from("orders")
    .update({ stripe_checkout_session_id: session.id } as never)
    .eq("id", orderId);

  return { url: session.url ?? undefined };
}

// Used by the checkout form to show the signed-in customer's spendable store
// credit (0 / not shown for guests). Currency is GBP — the store's single
// settlement currency (checkout already rejects mixed-currency bags).
export async function getStoreCreditPreview(): Promise<{ balance: number; currency: string }> {
  const customer = await getCustomer();
  if (!customer) return { balance: 0, currency: "GBP" };
  const balance = await getAvailableCredit(customer.id, "GBP");
  return { balance, currency: "GBP" };
}

// Used by the checkout form to validate a discount code before paying.
export async function previewPromoAction(
  code: string,
): Promise<{ valid: boolean; percent?: number; message: string }> {
  const pct = await getPromoPercent(code);
  if (!pct) return { valid: false, message: "That code isn't valid." };
  return { valid: true, percent: pct, message: `${pct}% off applied at checkout.` };
}

// Returns the URL only if it's a well-formed absolute http(s) URL — the form
// Stripe accepts for `product_data.images`. Anything else returns null so the
// image is simply omitted rather than failing the whole checkout session.
function safeImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
