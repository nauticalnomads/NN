"use client";

import { useState } from "react";
import { bulkTag } from "../actions";

type Product = { id: string; title: string; gender: string | null; category_slug: string | null };
type Cat = { slug: string; title: string; gender: string | null };

export function BulkTagger({ products, categories }: { products: Product[]; categories: Cat[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allVisible = products.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allVisible ? new Set() : new Set(products.map((p) => p.id)));

  return (
    <form action={bulkTag} className="mt-6">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="product_ids" value={id} />
      ))}

      <div className="sticky top-16 z-10 flex flex-wrap items-end gap-3 rounded-sm border border-ink/10 bg-surface-2 p-4">
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Gender</span>
          <select
            name="gender"
            className="mt-1 block rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          >
            <option value="">— leave unchanged —</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Category
          </span>
          <select
            name="category_slug"
            className="mt-1 block min-w-56 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          >
            <option value="">— leave unchanged —</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title} {c.gender ? `(${c.gender})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={selected.size === 0}
          className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase disabled:opacity-40"
        >
          Apply to {selected.size} selected
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-sm border border-ink/10">
        <table className="w-full text-left">
          <thead className="bg-surface-2 font-mono text-caption tracking-wide text-ink/60 uppercase">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allVisible}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-accent-sun"
                />
              </th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-t border-ink/10 font-body text-body text-ink hover:bg-surface-2"
                onClick={() => toggle(p.id)}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 accent-accent-sun"
                  />
                </td>
                <td className="px-4 py-3">{p.title}</td>
                <td className="px-4 py-3 font-mono text-caption text-ink/60">{p.gender ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-caption text-ink/60">
                  {p.category_slug ?? "—"}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-body text-ink/50">
                  Every product has a gender and category. Nothing left to tag.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
