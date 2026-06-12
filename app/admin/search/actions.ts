"use server";

import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export type SearchResult =
  | { type: "product"; id: string; title: string; sub: string; href: string }
  | { type: "order"; id: string; title: string; sub: string; href: string };

// Global admin search for the Cmd-K palette. Staff-gated. Products are visible to
// all staff; orders are ops-only (master/regular), matching the nav permissions.
// Best-effort: any query failure yields no results for that section rather than
// throwing, so the palette stays usable.
export async function searchAdminItems(query: string): Promise<SearchResult[]> {
  const user = await requireStaff();
  const q = query.trim();
  if (q.length < 2) return [];

  const sb = createServiceClient();
  const like = `%${q}%`;
  const isOps = user.role === "master" || user.role === "regular";

  const results: SearchResult[] = [];

  // Products — title or slug.
  try {
    const { data } = await sb
      .from("products")
      .select("id, title, slug, status")
      .or(`title.ilike.${like},slug.ilike.${like}`)
      .order("title")
      .limit(6);
    for (const p of (data as unknown as {
      id: string;
      title: string;
      slug: string;
      status: string;
    }[]) ?? []) {
      results.push({
        type: "product",
        id: p.id,
        title: p.title,
        sub: `Product · ${p.status}`,
        href: `/admin/products/${p.id}`,
      });
    }
  } catch {
    /* skip products section */
  }

  // Orders — email or order number (ops only).
  if (isOps) {
    try {
      const { data } = await sb
        .from("orders")
        .select("id, order_number, email, status, grand_total, currency")
        .or(`email.ilike.${like},order_number.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(6);
      for (const o of (data as unknown as {
        id: string;
        order_number: string | null;
        email: string;
        status: string;
      }[]) ?? []) {
        results.push({
          type: "order",
          id: o.id,
          title: o.order_number ? `#${o.order_number}` : o.email,
          sub: `Order · ${o.email} · ${o.status}`,
          href: `/admin/orders/${o.id}`,
        });
      }
    } catch {
      /* skip orders section */
    }
  }

  return results;
}
