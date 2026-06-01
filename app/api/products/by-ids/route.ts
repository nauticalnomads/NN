import { NextResponse, type NextRequest } from "next/server";
import { getProductsByIds } from "@/lib/queries";
import { primaryImage } from "@/lib/product";

export const runtime = "nodejs";

// Lightweight product lookup for the client wishlist page (§10). Returns just
// what a product card needs. Published-only (via the query helper + RLS).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map(String).slice(0, 200) : [];
  const products = await getProductsByIds(ids);
  // Return the full shape the ProductCard expects (it's a client component that
  // takes ProductWithRelations).
  return NextResponse.json({
    products,
    // a compact index so the client can preserve its own order if it wants
    primary: Object.fromEntries(products.map((p) => [p.id, primaryImage(p)?.url ?? null])),
  });
}
