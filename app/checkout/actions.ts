"use server";

import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { quoteShipping, type ShippingAddress, type CartLine } from "@/lib/shipping";
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
  const sb = createServiceClient();
  // Enrich cart lines with provider mapping for live shipping + fulfilment.
  // `provider` + `provider_product_id` live on the products table; per-variant
  // `provider_variant_id` lives on variants. One join, one round-trip.
  const variantIds = items.map((i) => i.variantId);
  const { data: variantRows } = await sb
    .from("variants")
    .select("id, provider_variant_id, products(provider, provider_product_id)")
    .in("id", variantIds);
  type V = {
    id: string;
    provider_variant_id: string | null;
    products: { provider: CartLine["provider"]; provider_product_id: string | null } | null;
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
  const cartLines: CartLine[] = items.map((i) => ({
    ...enrich(i.variantId),
    quantity: i.quantity,
  }));

  const shipping = await quoteShipping(cartLines, shipping_address);
  const currency = (items[0]?.currency || "GBP").toLowerCase();
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
      unit_price: i.price,
      quantity: i.quantity,
      currency: i.currency,
    };
  });
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
