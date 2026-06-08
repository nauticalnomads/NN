import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendAbandonedCart } from "@/lib/email";
import { tokenAuthorized } from "@/lib/webhook-auth";

// Scheduled by Cloudflare Cron Trigger (or hit manually with the secret token).
// Finds orders that are still 'pending' 1-3h after creation, has an email but
// no payment, and sends one nudge. The order row carries an 'abandoned_email_at'
// marker (stored on shipping_quote.metadata) to avoid double-sending.
//
// Configure in Cloudflare: Workers → Cron Triggers, e.g. every hour.
// Or any external cron hitting:
//   POST /api/cron/abandoned-cart  with header X-NN-Cron-Secret matching env.
export async function POST(request: NextRequest) {
  // Fail closed: an unset CRON_SECRET rejects everything (set it in Cloudflare).
  const expected = process.env.CRON_SECRET;
  if (!tokenAuthorized(expected, request.headers.get("x-nn-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = createServiceClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const threeAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data } = await sb
    .from("orders")
    .select("id, email, shipping_quote, created_at")
    .eq("status", "pending")
    .lt("created_at", hourAgo)
    .gt("created_at", threeAgo);
  const rows =
    (data as unknown as Array<{
      id: string;
      email: string;
      shipping_quote: Record<string, unknown> | null;
      created_at: string;
    }>) || [];

  // Load the suppression list once (marketing unsubscribes). Defensive: if the
  // table isn't migrated yet, treat everyone as subscribed.
  const suppressed = new Set<string>();
  try {
    const { data: sup } = await sb.from("email_suppressions").select("email");
    for (const s of (sup as unknown as Array<{ email: string }>) ?? []) {
      suppressed.add(s.email.toLowerCase());
    }
  } catch {
    /* table not present yet */
  }

  let sent = 0;
  for (const o of rows) {
    if (
      o.shipping_quote &&
      (o.shipping_quote as { abandoned_email_at?: string }).abandoned_email_at
    )
      continue;
    if (suppressed.has((o.email || "").toLowerCase())) continue; // respect unsubscribe
    const { data: itemsData } = await sb
      .from("order_items")
      .select("title, unit_price, currency")
      .eq("order_id", o.id);
    const items =
      (itemsData as unknown as Array<{ title: string; unit_price: number; currency: string }>) ??
      [];
    if (items.length === 0) continue;
    await sendAbandonedCart(
      o.email,
      items.map((i) => ({ title: i.title, price: i.unit_price, currency: i.currency })),
    );
    await sb
      .from("orders")
      .update({
        shipping_quote: {
          ...(o.shipping_quote ?? {}),
          abandoned_email_at: new Date().toISOString(),
        },
      } as never)
      .eq("id", o.id);
    sent++;
  }

  return NextResponse.json({ sent, candidates: rows.length });
}
