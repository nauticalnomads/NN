// Auto-fulfilment service (§B-07). On a paid order, group items by provider
// and place a provider order for each. Records every attempt in
// `fulfilment_attempts` with an idempotency key. Safety rails:
//   - `store_settings.auto_fulfilment_enabled` is the kill-switch
//   - `store_settings.fulfilment_dry_run` blocks real POD calls (default ON)
//   - permanent failures create a `notifications` row + flip order status
import { createServiceClient } from "@/lib/supabase/service";
import { printfulHeaders } from "@/lib/shipping-printful";

type OrderItem = {
  id: string;
  order_id: string;
  provider: "printful" | "printify" | null;
  provider_variant_id: string | null;
  quantity: number;
  unit_price: number;
};
type Order = {
  id: string;
  email: string;
  shipping_address: Record<string, string> | null;
};

async function settings() {
  const sb = createServiceClient();
  const { data } = await sb
    .from("store_settings")
    .select("auto_fulfilment_enabled, fulfilment_dry_run")
    .eq("id", true)
    .maybeSingle();
  return data as unknown as {
    auto_fulfilment_enabled: boolean;
    fulfilment_dry_run: boolean;
  } | null;
}

async function placePrintful(order: Order, items: OrderItem[]) {
  const addr = order.shipping_address ?? {};
  const body = {
    external_id: order.id,
    confirm: true,
    recipient: {
      name: addr.name || "",
      address1: addr.line1 || "",
      address2: addr.line2 || "",
      city: addr.city || "",
      country_code: addr.country || "",
      zip: addr.postal_code || "",
      email: order.email,
    },
    items: items.map((i) => ({
      variant_id: Number(i.provider_variant_id),
      quantity: i.quantity,
      retail_price: i.unit_price.toFixed(2),
    })),
  };
  const res = await fetch("https://api.printful.com/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...printfulHeaders() },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Printful ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return { providerOrderId: String(j?.result?.id), raw: j?.result };
}

async function placePrintify(order: Order, items: OrderItem[]) {
  const shop = process.env.PRINTIFY_SHOP_ID;
  if (!shop) throw new Error("PRINTIFY_SHOP_ID missing");
  const addr = order.shipping_address ?? {};
  const body = {
    external_id: order.id,
    label: `NN ${order.id.slice(0, 8)}`,
    line_items: items.map((i) => ({
      product_id: i.provider_variant_id, // not strictly correct — see below
      variant_id: Number(i.provider_variant_id),
      quantity: i.quantity,
    })),
    shipping_method: 1, // standard
    send_shipping_notification: true,
    address_to: {
      first_name: (addr.name || "").split(" ")[0] || "",
      last_name: (addr.name || "").split(" ").slice(1).join(" ") || "",
      email: order.email,
      address1: addr.line1 || "",
      address2: addr.line2 || "",
      city: addr.city || "",
      country: addr.country || "",
      zip: addr.postal_code || "",
    },
  };
  const res = await fetch(`https://api.printify.com/v1/shops/${shop}/orders.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PRINTIFY_API_KEY ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Printify ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return { providerOrderId: String(j?.id ?? j?.data?.id ?? ""), raw: j };
}

// Public entrypoint. Called from the Stripe webhook on `checkout.session.completed`.
// Idempotent on (order_id, provider) — re-running is safe.
export async function autoFulfilOrder(orderId: string) {
  const sb = createServiceClient();
  const s = await settings();

  if (!s?.auto_fulfilment_enabled) {
    await sb
      .from("orders")
      .update({ status: "awaiting_fulfilment" } as never)
      .eq("id", orderId);
    return { skipped: "kill-switch" };
  }

  const { data: orderRow } = await sb
    .from("orders")
    .select("id, email, shipping_address, status")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderRow as unknown as (Order & { status: string }) | null;
  if (!order) return { error: "order not found" };

  const { data: itemsData } = await sb
    .from("order_items")
    .select("id, order_id, provider, provider_variant_id, quantity, unit_price")
    .eq("order_id", orderId);
  const items = (itemsData as unknown as OrderItem[]) ?? [];

  await sb
    .from("orders")
    .update({ status: "fulfilling" } as never)
    .eq("id", orderId);

  // Group by provider.
  const byProvider = new Map<string, OrderItem[]>();
  for (const it of items) {
    if (!it.provider) continue; // unmapped — manual
    const list = byProvider.get(it.provider) ?? [];
    list.push(it);
    byProvider.set(it.provider, list);
  }

  const results: { provider: string; ok: boolean; providerOrderId?: string; error?: string }[] = [];

  for (const [provider, group] of byProvider) {
    const idempotency_key = `${orderId}::${provider}`;
    // Idempotency: skip if a successful attempt already exists.
    const { data: existing } = await sb
      .from("fulfilment_attempts")
      .select("id, status, provider_order_id")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();
    const ex = existing as unknown as { status: string; provider_order_id: string | null } | null;
    if (ex?.status === "success") {
      results.push({ provider, ok: true, providerOrderId: ex.provider_order_id ?? undefined });
      continue;
    }

    let providerOrderId: string | undefined;
    let errMsg: string | undefined;

    if (s.fulfilment_dry_run) {
      // No real provider call — record a synthetic attempt so the admin sees
      // the dry-run pathway in the audit log.
      providerOrderId = `DRYRUN-${provider}-${orderId.slice(0, 8)}`;
    } else {
      try {
        const placed =
          provider === "printful"
            ? await placePrintful(order, group)
            : provider === "printify"
              ? await placePrintify(order, group)
              : { providerOrderId: `UNMAPPED-${orderId.slice(0, 8)}` };
        providerOrderId = placed.providerOrderId;
      } catch (err) {
        errMsg = err instanceof Error ? err.message : String(err);
      }
    }

    await sb.from("fulfilment_attempts").insert({
      order_id: orderId,
      provider,
      status: errMsg ? "failed" : "success",
      idempotency_key,
      provider_order_id: providerOrderId ?? null,
      error_detail: errMsg ?? null,
    } as never);

    results.push({ provider, ok: !errMsg, providerOrderId, error: errMsg });
  }

  const allOk = results.every((r) => r.ok);

  // Update order with per-provider refs + status.
  await sb
    .from("orders")
    .update({
      status: allOk ? "fulfilling" : "fulfilment_failed",
      provider_orders: results.map((r) => ({
        provider: r.provider,
        provider_order_id: r.providerOrderId,
        status: r.ok ? "placed" : "failed",
      })),
    } as never)
    .eq("id", orderId);

  if (!allOk) {
    await sb.from("notifications").insert({
      type: "fulfilment_failed",
      title: "Fulfilment failed",
      body: `Order ${orderId}: ${results
        .filter((r) => !r.ok)
        .map((r) => `${r.provider}: ${r.error}`)
        .join("; ")}`,
      order_id: orderId,
    } as never);
  }

  return { results, allOk };
}
