import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { FILTERS } from "../filters";

// CSV export of the orders list, honouring the same saved filter the table
// shows (?status=needs_action etc). Ops-gated like the page itself — route
// handlers don't inherit the layout, so the role check lives here.
export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user || (user.role !== "master" && user.role !== "regular")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? "";
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0];

  const sb = createServiceClient();
  let query = sb
    .from("orders")
    .select(
      "order_number, id, email, status, subtotal, shipping_total, grand_total, currency, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (filter.statuses) query = query.in("status", filter.statuses);
  const { data } = await query;
  const rows =
    (data as unknown as Array<{
      order_number: string | null;
      id: string;
      email: string;
      status: string;
      subtotal: number;
      shipping_total: number;
      grand_total: number;
      currency: string;
      created_at: string;
    }>) ?? [];

  const esc = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "order,email,status,subtotal,shipping,total,currency,placed";
  const lines = rows.map((o) =>
    [
      esc(o.order_number ?? o.id.slice(0, 8)),
      esc(o.email),
      esc(o.status),
      esc(o.subtotal),
      esc(o.shipping_total),
      esc(o.grand_total),
      esc(o.currency),
      esc(o.created_at),
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = filter.key ? `-${filter.key}` : "";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders${suffix}-${stamp}.csv"`,
    },
  });
}
