"use client";

import { useState } from "react";
import { saveFooterTags } from "./actions";

type Tag = { label: string; href: string };

export function FooterTagEditor({ initial }: { initial: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(initial.length ? initial : []);

  const update = (i: number, k: keyof Tag, v: string) =>
    setTags((t) => t.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const add = () => setTags((t) => [...t, { label: "", href: "" }]);
  const remove = (i: number) => setTags((t) => t.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setTags((t) => {
      const j = i + dir;
      if (j < 0 || j >= t.length) return t;
      const copy = [...t];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  return (
    <form action={saveFooterTags} className="space-y-3">
      <input type="hidden" name="tags" value={JSON.stringify(tags)} />
      <ul className="space-y-2">
        {tags.map((t, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={t.label}
              onChange={(e) => update(i, "label", e.target.value)}
              placeholder="Label"
              className="w-40 rounded-sm border border-ink/20 bg-surface px-2 py-1.5 font-body text-caption"
            />
            <input
              value={t.href}
              onChange={(e) => update(i, "href", e.target.value)}
              placeholder="/collections/…"
              className="flex-1 rounded-sm border border-ink/20 bg-surface px-2 py-1.5 font-mono text-caption"
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              aria-label="Up"
              className="px-1 text-ink/50 hover:text-ink"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              aria-label="Down"
              className="px-1 text-ink/50 hover:text-ink"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove"
              className="px-1 text-accent-sun"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={tags.length >= 20}
          className="rounded-sm border border-ink/20 px-3 py-1 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun disabled:opacity-40"
        >
          + Add tag
        </button>
        <button className="rounded-sm bg-accent-sun px-5 py-2 font-mono text-xs tracking-widest text-surface uppercase">
          Save tags
        </button>
        <span className="font-mono text-caption text-ink/40">{tags.length}/20</span>
      </div>
    </form>
  );
}
