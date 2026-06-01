"use client";

import { useState } from "react";

export type Faq = { q: string; a: string };

export function FaqAccordion({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-ink/10">
      {items.map((f, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between py-4 text-left font-body text-[15px] font-semibold text-deep-ink"
          >
            {f.q}
            <span className="ml-4 text-ink/50">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && (
            <p className="pb-4 font-body text-body leading-relaxed text-ink/75">{f.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}
