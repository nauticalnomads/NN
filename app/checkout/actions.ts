"use server";

import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { quoteShipping, type ShippingAddress } from "@/lib/shipping";
import type { CartItem } from "@/components/cart/CartProvider";
import { absoluteUrl } from "@/lib/site";

type Payload = {
  email: string;
  shipping_address: ShippingAddress;
  items: CartItem[];
};

export async function createCheckoutSession(
  payload: Payload,
): Promise<{ url?: string; error?: string }> {
  const { email, shipping_address, items } = payload;
  if (!email || !items.length) return { error: "Missing email or items." };

  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Payments are not configured yet (STRIPE_SECRET_KEY missing)." };
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = await quoteShipping(shipping_address, items.length);
  const currency = (items[0]?.currency || "GBP").toLowerCase();

  // Pre-create the order in 'pending' state with the immutable snapshot.
  // The Stripe webhook flips it to 'paid' on success.
  const sb = createServiceClient();
  const orderRow = {
    email,
    status: "pending" as const,
    currency: currency.toUpperCase(),
    subtotal,
    shipping_total: shipping.rate,
    tax_total: 0,
    grand_total: subtotal + shipping.rate,
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

  // Snapshot the line items NOW (immutable). Order items reference variants/products
  // for analytics but their displayed values come from these snapshot columns.
  const itemRows = items.map((i) => ({
    order_id: orderId,
    product_id: i.productId,
    variant_id: i.variantId,
    title: i.title,
    variant_title: i.variantTitle,
    sku: i.sku,
    unit_price: i.price,
    quantity: i.quantity,
    currency: i.currency,
  }));
  await sb.from("order_items").insert(itemRows as never);

  // Build Stripe line items + flat shipping option.
  const stripe = getStripe();
  const lineItems = items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency,
      unit_amount: Math.round(i.price * 100),
      product_data: {
        name: i.variantTitle ? `${i.title} — ${i.variantTitle}` : i.title,
        ...(i.imageUrl ? { images: [i.imageUrl] } : {}),
        metadata: { sku: i.sku, variant_id: i.variantId, product_id: i.productId },
      },
    },
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: lineItems,
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

  // Save the Stripe session id for reconciliation.
  await sb
    .from("orders")
    .update({ stripe_checkout_session_id: session.id } as never)
    .eq("id", orderId);

  return { url: session.url ?? undefined };
}
