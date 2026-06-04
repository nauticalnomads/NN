import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendShippingConfirmation } from "@/lib/email";
import { resolveStoreId } from "@/lib/printful";
import { importPrintfulProduct } from "@/lib/printful-import";

// Printful webhook (configure in Printful → Settings → Webhooks).
// - package_shipped → update order tracking + email the customer.
// - product_synced  → auto-create a draft product here (publish-on-Printful → draft-on-admin).
export async function POST(request: NextRequest) {
  const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
  const provided =
    request.headers.get("x-pf-webhook-token") || request.nextUrl.searchParams.get("token");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const event = await request.json().catch(() => null);
  if (!event) return NextResponse.json({ ok: true });

  // New/changed sync product in the Printful store → draft it here (idempotent).
  if (event.type === "product_synced" || event.type === "product_updated") {
    const syncId = event.data?.sync_product?.id;
    if (syncId) {
      const sb = createServiceClient();
      const storeId = (await resolveStoreId().catch(() => null)) ?? undefined;
      await importPrintfulProduct(sb, syncId, storeId).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === "package_shipped") {
    const sb = createServiceClient();
    const shipment = event.data?.shipment;
    const orderExternalId = event.data?.order?.external_id;
    if (orderExternalId && shipment) {
      const tracking = {
        carrier: shipment.carrier,
        number: shipment.tracking_number,
        url: shipment.tracking_url,
        provider: "printful",
      };
      // Append to tracking[] + flip status.
      const { data: row } = await sb
        .from("orders")
        .select("tracking, status")
        .eq("id", orderExternalId)
        .maybeSingle();
      const cur = (row as unknown as { tracking: unknown[]; status: string } | null) ?? null;
      const next = [...(cur?.tracking ?? []), tracking];
      await sb
        .from("orders")
        .update({
          tracking: next,
          status: cur?.status === "delivered" ? "delivered" : "shipped",
        } as never)
        .eq("id", orderExternalId);
      sendShippingConfirmation(orderExternalId, tracking).catch((e) =>
        console.error("ship email:", e),
      );
    }
  }

  return NextResponse.json({ ok: true });
}
