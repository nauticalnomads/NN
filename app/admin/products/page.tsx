import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { setProductStatus } from "./actions";

export default async function AdminProducts() {
  await requireStaff();
  const sb = await createClient();
  const { data } = await sb
    .from("products")
    .select("id, slug, title, status, price, currency, provider, base_cost")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows =
    (data as unknown as Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      price: number;
      currency: string;
      provider: string | null;
      base_cost: number | null;
    }>) || [];

  return (
    <div>
      <h1 className="font-display text-display-2 tracking-tight text-ink">Products</h1>
      <p className="mt-3 font-body text-body text-ink/60">
        {rows.length} most recent. Publishing a draft auto-queues a blog draft.
      </p>
      <div className="mt-8 overflow-hidden rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2">
            <tr className="font-mono text-caption tracking-wide text-ink/60 uppercase">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-ink/10 font-body text-body text-ink">
                <td className="px-4 py-3">
                  <Link href={`/products/${p.slug}`} className="text-ink hover:text-accent-sun">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-caption uppercase">{p.status}</td>
                <td className="px-4 py-3 font-mono text-caption uppercase">{p.provider ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatPrice(p.price, p.currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-ink/60">
                  {p.base_cost != null ? formatPrice(p.base_cost, p.currency) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-mono text-xs tracking-widest text-ink/70 uppercase no-underline hover:text-accent-sun"
                    >
                      Edit
                    </Link>
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
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-body text-ink/50">
                  Catalogue empty — run the migration.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
