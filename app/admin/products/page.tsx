import Link from "next/link";
import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { setProductStatus } from "./actions";
import { CategorySelect, CategoryFilter } from "./CategoryControls";

type Img = { url: string; is_primary: boolean; sort_order: number };
type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  price: number;
  currency: string;
  provider: string | null;
  base_cost: number | null;
  category_slug: string | null;
  product_images: Img[];
};

function thumb(images: Img[]): string | null {
  const sorted = [...(images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return sorted[0]?.url ?? null;
}

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireStaff();
  const { category = "" } = await searchParams;
  const sb = await createClient();

  // Category options (breadcrumb labels) from the full taxonomy.
  const { data: cols } = await sb
    .from("collections")
    .select("slug, title, parent_slug, gender")
    .order("gender")
    .order("title");
  const collections =
    (cols as unknown as {
      slug: string;
      title: string;
      parent_slug: string | null;
      gender: string | null;
    }[]) ?? [];
  const titleBySlug = Object.fromEntries(collections.map((c) => [c.slug, c.title]));
  const catOptions = collections.map((c) => ({
    value: c.slug,
    label: c.parent_slug ? `${titleBySlug[c.parent_slug] ?? c.parent_slug} › ${c.title}` : c.title,
  }));

  let query = sb
    .from("products")
    .select(
      "id, slug, title, status, price, currency, provider, base_cost, category_slug, product_images(url, is_primary, sort_order)",
    )
    .order("title")
    .limit(1000);
  if (category === "__none__") query = query.is("category_slug", null);
  else if (category) query = query.eq("category_slug", category);
  const { data } = await query;
  const rows = (data as unknown as Row[]) || [];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-display-2 tracking-tight text-ink">Products</h1>
        <Link
          href="/admin/products/import"
          className="rounded-sm bg-accent-sun px-4 py-2 font-mono text-xs tracking-widest text-surface uppercase no-underline"
        >
          Import from Printful →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-body text-body text-ink/60">
          {rows.length} product{rows.length === 1 ? "" : "s"}
          {category ? " (filtered)" : ""}. Set a category to file it into the matching collection.
        </p>
        <CategoryFilter current={category} options={catOptions} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2">
            <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const src = thumb(p.product_images);
              return (
                <tr key={p.id} className="border-t border-ink/10 font-body text-body text-ink">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-driftwood">
                        {src && (
                          <Image src={src} alt="" fill unoptimized className="object-cover" />
                        )}
                      </div>
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="text-ink no-underline hover:text-accent-sun"
                      >
                        {p.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CategorySelect
                      productId={p.id}
                      current={p.category_slug}
                      options={catOptions}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-caption uppercase">{p.status}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatPrice(p.price, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={setProductStatus}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={p.status === "published" ? "draft" : "published"}
                      />
                      <button className="rounded-sm border border-ink/20 px-3 py-1 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun">
                        {p.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-body text-ink/50">
                  No products{category ? " in this category" : " — run the migration"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
