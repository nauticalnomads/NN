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
  sort_order: number | null;
};

const ROOT_ORDER: Record<string, number> = { men: 0, women: 1, accessories: 2 };

export default async function AdminCollections() {
  await requireStaff();
  const sb = createServiceClient();

  const { data } = await sb
    .from("collections")
    .select("id, slug, title, gender, parent_slug, status, sort_order")
    .order("sort_order");
  const rows = (data as unknown as Row[]) ?? [];

  // Arrange as the live hierarchy: roots (Men/Women/Accessories) → categories →
  // subcategories, each ordered by sort_order. Carries a depth for indentation.
  const childrenOf = (slug: string | null) =>
    rows
      .filter((r) => r.parent_slug === slug)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const ordered: Array<Row & { depth: number }> = [];
  const walk = (slug: string, depth: number) => {
    const node = rows.find((r) => r.slug === slug);
    if (!node) return;
    ordered.push({ ...node, depth });
    childrenOf(slug).forEach((c) => walk(c.slug, depth + 1));
  };
  rows
    .filter((r) => !r.parent_slug)
    .sort((a, b) => (ROOT_ORDER[a.slug] ?? 99) - (ROOT_ORDER[b.slug] ?? 99))
    .forEach((root) => walk(root.slug, 0));
  // Any orphans (parent not found) appended so nothing is hidden.
  const seen = new Set(ordered.map((o) => o.id));
  rows.filter((r) => !seen.has(r.id)).forEach((r) => ordered.push({ ...r, depth: 0 }));

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
            {ordered.map((c) => {
              const count = counts.get(c.id) ?? 0;
              return (
                <tr
                  key={c.id}
                  className={`border-t border-ink/10 font-body text-body text-ink ${
                    c.depth === 0 ? "bg-surface-2/40 font-medium" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      style={{ paddingLeft: `${c.depth * 1.5}rem` }}
                      className="inline-flex items-baseline"
                    >
                      {c.depth > 0 && <span className="mr-2 text-ink/30">└</span>}
                      <Link
                        href={`/admin/collections/${c.id}`}
                        className="text-ink no-underline hover:text-accent-sun"
                      >
                        {c.title}
                      </Link>
                      <span className="ml-2 font-mono text-caption text-ink/40">/{c.slug}</span>
                    </span>
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
