import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendShippingConfirmation } from "@/lib/email";

// Printful shipment update webhook (configure in Printful → Webhooks).
// Updates the order's tracking array + flips to 'shipped' on first shipment,
// then triggers the customer's shipping email.
export async function POST(request: NextRequest) {
  const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
  const provided =
    request.headers.get("x-pf-webhook-token") || request.nextUrl.searchParams.get("token");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const event = await request.json().catch(() => null);
  if (!event) return NextResponse.json({ ok: true });

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
