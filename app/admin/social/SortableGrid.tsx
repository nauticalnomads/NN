"use client";

import { useState } from "react";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import { saveSocialOrder } from "./actions";

type Tile = { id: string; name: string; thumb: string };

// Instagram-style 3-up grid of Drive photos that you drag to reorder. The new
// order is held in local state and only persisted (+ the schedule rebuilt) when
// "Save order" is pressed — dragging alone never touches the schedule.
export function SortableGrid({ tiles }: { tiles: Tile[] }) {
  const [items, setItems] = useState<Tile[]>(tiles);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  function move(from: number, to: number) {
    if (from === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDirty(true);
  }

  return (
    <div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="font-mono text-caption text-ink/40">
          Drag photos to set the posting order — top-left posts first. Nothing reschedules until you
          save.
        </p>
        <form action={saveSocialOrder} onSubmit={() => setDirty(false)}>
          <input type="hidden" name="order" value={JSON.stringify(items.map((t) => t.id))} />
          <SaveButton dirty={dirty} />
        </form>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-1.5">
        {items.map((t, i) => (
          <li
            key={t.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`relative aspect-square cursor-grab overflow-hidden bg-ink/5 active:cursor-grabbing ${
              dragIndex === i ? "opacity-40" : ""
            }`}
            title={t.name}
          >
            <Image src={t.thumb} alt={t.name} fill unoptimized className="object-cover" />
            <span className="absolute top-1 left-1 rounded-sm bg-ink/70 px-1.5 py-0.5 font-mono text-[10px] text-surface">
              {i + 1}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-sm bg-accent-sun px-5 py-2 font-mono text-caption tracking-widest text-surface uppercase disabled:opacity-50"
    >
      {pending ? "Saving…" : dirty ? "Save order •" : "Save order"}
    </button>
  );
}
