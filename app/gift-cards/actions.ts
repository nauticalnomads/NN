"use server";

import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { absoluteUrl } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import {
  createPendingGiftCard,
  previewGiftCard,
  GIFT_CARD_MIN,
  GIFT_CARD_MAX,
} from "@/lib/gift-cards";

// Buy a digital gift card: create a pending order + a pending gift card, then a
// Stripe Checkout session. On payment the webhook activates the card and emails
// the code to the purchaser (see lib/orders.ts → processGiftCardsForOrder).
export async function createGiftCardCheckout(input: {
  amount: number;
  email: string;
}): Promise<{ url?: string; error?: string }> {
  const email = (input.email ?? "").trim();
  const amount = Math.round(Number(input.amount));
  const currency = "GBP";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!Number.isFinite(amount) || amount < GIFT_CARD_MIN || amount > GIFT_CARD_MAX) {
    return {
      error: `Choose an amount between ${formatPrice(GIFT_CARD_MIN)} and ${formatPrice(GIFT_CARD_MAX)}.`,
    };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Payments are not configured yet." };
  }

  const sb = createServiceClient();

  const { data: order, error: orderErr } = await sb
    .from("orders")
    .insert({
      email,
      status: "pending",
      currency,
      subtotal: amount,
      shipping_total: 0,
      tax_total: 0,
      discount_total: 0,
      grand_total: amount,
    } as never)
    .select("id")
    .single();
  if (orderErr || !order) {
    console.error("gift card order pre-create failed:", orderErr?.message);
    return { error: "Couldn't start checkout. Try again." };
  }
  const orderId = (order as unknown as { id: string }).id;

  // A line item so the purchase shows in admin/orders + the receipt email.
  // No provider → fulfilment skips it (lib/fulfilment.ts).
  await sb.from("order_items").insert({
    order_id: orderId,
    title: `Gift Card — ${formatPrice(amount, currency)}`,
    sku: "GIFT-CARD",
    unit_price: amount,
    quantity: 1,
    currency,
  } as never);

  const card = await createPendingGiftCard({ amount, currency, email, orderId });
  if (!card) return { error: "Couldn't create the gift card. Try again." };

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: "Nautical Nomads Gift Card",
              description: `Digital gift card — ${formatPrice(amount, currency)}`,
            },
          },
        },
      ],
      success_url: absoluteUrl(`/orders/${orderId}?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: absoluteUrl("/gift-cards"),
      payment_intent_data: { metadata: { order_id: orderId, gift_card: "true" } },
      metadata: { order_id: orderId, gift_card: "true" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("gift card session create failed:", message);
    return { error: `Payment provider error: ${message}` };
  }

  await sb
    .from("orders")
    .update({ stripe_checkout_session_id: session.id } as never)
    .eq("id", orderId);

  return { url: session.url ?? undefined };
}

// Used by the checkout form to show a gift card's balance before paying.
export async function previewGiftCardAction(code: string) {
  return previewGiftCard(code, "GBP");
}
