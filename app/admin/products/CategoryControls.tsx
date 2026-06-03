"use client";

import { useRef } from "react";
import { setProductCategory } from "./actions";

type Opt = { value: string; label: string };

// Per-row category picker — auto-submits the server action on change.
export function CategorySelect({
  productId,
  current,
  options,
}: {
  productId: string;
  current: string | null;
  options: Opt[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={setProductCategory}>
      <input type="hidden" name="product_id" value={productId} />
      <select
        name="category_slug"
        defaultValue={current ?? ""}
        onChange={() => ref.current?.requestSubmit()}
        className="max-w-[16rem] rounded-sm border border-ink/20 bg-surface px-2 py-1 font-body text-caption"
      >
        <option value="">— Uncategorized —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}

// Top-of-page category filter — GET navigation, auto-submits on change.
export function CategoryFilter({ current, options }: { current: string; options: Opt[] }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} method="get" className="flex items-center gap-2">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">Category</span>
      <select
        name="category"
        defaultValue={current}
        onChange={() => ref.current?.requestSubmit()}
        className="rounded-sm border border-ink/20 bg-surface px-2 py-1.5 font-body text-caption"
      >
        <option value="">All categories</option>
        <option value="__none__">Uncategorized</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
