import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";

export const runtime = "nodejs";

// Wishlist API (redesign v2 §10). Scoped to the signed-in customer via the
// cookie-bound client + RLS (wishlists_self). Guests never hit this — their
// list lives in localStorage. Returns { items: [{productId, variantId}] }.

export async function GET() {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ items: [] });
  const sb = await createClient();
  const { data } = await sb.from("wishlists").select("product_id, variant_id");
  const rows = (data as unknown as { product_id: string; variant_id: string | null }[]) ?? [];
  return NextResponse.json({
    items: rows.map((r) => ({ productId: r.product_id, variantId: r.variant_id })),
  });
}

export async function POST(request: NextRequest) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const sb = await createClient();
  const body = await request.json().catch(() => ({}));

  // Merge a batch from localStorage on sign-in.
  if (Array.isArray(body?.merge)) {
    const rows = body.merge
      .filter((i: { productId?: string }) => i?.productId)
      .map((i: { productId: string; variantId?: string | null }) => ({
        user_id: customer.user_id,
        product_id: i.productId,
        variant_id: i.variantId ?? null,
      }));
    if (rows.length) {
      await sb.from("wishlists").upsert(rows as never, { onConflict: "user_id,product_id" });
    }
    return NextResponse.json({ ok: true });
  }

  const productId = String(body?.product_id || "");
  if (!productId) return NextResponse.json({ error: "missing product" }, { status: 422 });
  await sb.from("wishlists").upsert(
    {
      user_id: customer.user_id,
      product_id: productId,
      variant_id: body?.variant_id ?? null,
    } as never,
    { onConflict: "user_id,product_id" },
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const sb = await createClient();
  const body = await request.json().catch(() => ({}));
  const productId = String(body?.product_id || "");
  if (!productId) return NextResponse.json({ error: "missing product" }, { status: 422 });
  // RLS (wishlists_self) already scopes this to the caller; the explicit user_id
  // filter is defence-in-depth so intent is clear and it's safe even if RLS were
  // ever relaxed.
  await sb
    .from("wishlists")
    .delete()
    .eq("user_id", customer.user_id ?? "")
    .eq("product_id", productId);
  return NextResponse.json({ ok: true });
}
