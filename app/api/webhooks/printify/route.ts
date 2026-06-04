import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendShippingConfirmation } from "@/lib/email";
import { getIntegrationConfig } from "@/lib/integrations";

// Printify order webhook. Configure in Printify → Settings → Webhooks.
// Subscribe to order:shipment:created (and optionally order:shipment:delivered).
export async function POST(request: NextRequest) {
  const event = await request.json().catch(() => null);
  if (!event) return NextResponse.json({ ok: true });

  // Validate by webhook secret (Printify includes it in the URL via token param).
  const secret = (await getIntegrationConfig()).printify.webhookSecret;
  const provided = request.nextUrl.searchParams.get("token");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (event.type === "order:shipment:created" || event.type === "order:shipment:delivered") {
    const sb = createServiceClient();
    const orderId = event.resource?.data?.external_id;
    const shipment = event.resource?.data?.shipments?.[0];
    if (orderId && shipment) {
      const tracking = {
        carrier: shipment.carrier,
        number: shipment.number,
        url: shipment.url,
        provider: "printify",
      };
      const { data: row } = await sb
        .from("orders")
        .select("tracking, status")
        .eq("id", orderId)
        .maybeSingle();
      const cur = (row as unknown as { tracking: unknown[]; status: string } | null) ?? null;
      const next = [...(cur?.tracking ?? []), tracking];
      const status = event.type === "order:shipment:delivered" ? "delivered" : "shipped";
      await sb
        .from("orders")
        .update({ tracking: next, status } as never)
        .eq("id", orderId);
      if (event.type === "order:shipment:created") {
        sendShippingConfirmation(orderId, tracking).catch((e) => console.error("ship email:", e));
      }
    }
  }

  return NextResponse.json({ ok: true });
}
