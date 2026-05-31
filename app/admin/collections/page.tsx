import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { setCollectionStatus } from "./actions";

type Row = {
  id: string;
  slug: string;
  title: string;
  gender: string | null;
  parent_slug: string | null;
  status: string;
};

export default async function AdminCollections() {
  await requireStaff();
  const sb = createServiceClient();

  const { data } = await sb
    .from("collections")
    .select("id, slug, title, gender, parent_slug, status")
    .order("gender")
    .order("sort_order");
  const rows = (data as unknown as Row[]) ?? [];

  // Product counts per collection.
  const { data: cp } = await sb.from("collection_products").select("collection_id");
  const counts = new Map<string, number>();
  for (const r of (cp as unknown as { collection_id: string }[]) ?? []) {
    counts.set(r.collection_id, (counts.get(r.collection_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-display-2 tracking-tight text-ink">Collections</h1>
        <Link
          href="/admin/collections/tag"
          className="rounded-sm bg-accent-sun px-4 py-2 font-mono text-xs tracking-widest text-surface uppercase no-underline"
        >
          Bulk product tagger →
        </Link>
      </div>
      <p className="mt-3 font-body text-body text-ink/60">
        {rows.length} collections (seeded as drafts). Assign products, then publish. A collection
        appears in nav only when published with ≥1 product.
      </p>

      <div className="mt-8 overflow-hidden rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2 font-mono text-caption tracking-wide text-ink/60 uppercase">
            <tr>
              <th className="px-4 py-3">Collection</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const count = counts.get(c.id) ?? 0;
              return (
                <tr key={c.id} className="border-t border-ink/10 font-body text-body text-ink">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/collections/${c.id}`}
                      className="text-ink no-underline hover:text-accent-sun"
                    >
                      {c.title}
                    </Link>
                    <span className="ml-2 font-mono text-caption text-ink/40">/{c.slug}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-caption">{c.gender ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-caption text-ink/60">
                    {c.parent_slug ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{count}</td>
                  <td className="px-4 py-3 font-mono text-caption uppercase">
                    <span className={c.status === "published" ? "text-accent-sea" : "text-ink/50"}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/collections/${c.id}`}
                        className="font-mono text-xs tracking-widest text-ink/70 uppercase no-underline hover:text-accent-sun"
                      >
                        Edit
                      </Link>
                      <form action={setCollectionStatus}>
                        <input type="hidden" name="id" value={c.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={c.status === "published" ? "draft" : "published"}
                        />
                        <button
                          disabled={c.status !== "published" && count === 0}
                          title={
                            c.status !== "published" && count === 0
                              ? "Assign at least one product first"
                              : ""
                          }
                          className="rounded-sm border border-ink/20 px-3 py-1 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun disabled:opacity-40"
                        >
                          {c.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
