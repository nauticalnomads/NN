import { NextResponse, type NextRequest } from "next/server";
import { requireOps } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

// CSV export of orders + COGS for the accountant. Master + regular only.
export async function GET(request: NextRequest) {
  await requireOps();
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date(Date.now() - 365 * 86400000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();

  const sb = createServiceClient();
  const { data } = await sb
    .from("orders")
    .select(
      "id, order_number, email, status, grand_total, subtotal, shipping_total, currency, created_at, placed_at",
    )
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at");
  const rows = (data as unknown as Array<Record<string, string | number | null>>) || [];

  const cols = [
    "id",
    "order_number",
    "email",
    "status",
    "subtotal",
    "shipping_total",
    "grand_total",
    "currency",
    "created_at",
    "placed_at",
  ];
  const csv = [cols.join(",")];
  for (const r of rows) {
    csv.push(cols.map((c) => JSON.stringify(r[c] ?? "")).join(","));
  }
  return new NextResponse(csv.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nn-orders-${from.slice(0, 10)}_to_${to.slice(0, 10)}.csv"`,
    },
  });
}
