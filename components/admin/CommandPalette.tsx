"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchAdminItems, type SearchResult } from "@/app/admin/search/actions";

type NavItem = { href: string; label: string };
type Item = { key: string; title: string; sub: string; href: string };

// Cmd-K (Ctrl-K) command palette for the admin. Jumps to any admin section and
// searches products + orders live. Nav targets are passed in already filtered to
// the signed-in user's role; the search action enforces the same gating server
// side. No dialog library — native keydown + a fixed overlay.
export function CommandPalette({ nav }: { nav: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter nav locally; live-search products/orders for queries of 2+ chars.
  const q = query.trim().toLowerCase();
  const navItems: Item[] = nav
    .filter((n) => !q || n.label.toLowerCase().includes(q))
    .map((n) => ({ key: `nav:${n.href}`, title: n.label, sub: "Go to page", href: n.href }));
  const remoteItems: Item[] = remote.map((r) => ({
    key: `${r.type}:${r.id}`,
    title: r.title,
    sub: r.sub,
    href: r.href,
  }));
  const items = [...navItems, ...remoteItems];

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRemote([]);
    setActive(0);
  }, []);

  // Global Cmd/Ctrl-K toggle + Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Lock scroll + focus the input while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Debounced live search.
  useEffect(() => {
    if (!open) return;
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    const t = setTimeout(() => {
      searchAdminItems(query)
        .then(setRemote)
        .catch(() => setRemote([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, q, open]);

  // Keep the active row in range as the list changes.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  function go(href: string) {
    close();
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) go(it.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 flex w-full items-center justify-between rounded-sm border border-ink/15 bg-surface px-3 py-2 font-mono text-caption text-ink/50 transition-colors hover:border-ink/40"
        aria-label="Open search"
      >
        <span>Search…</span>
        <span className="rounded-sm border border-ink/15 px-1.5 py-0.5 text-[10px] tracking-wide">
          ⌘K
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <div className="absolute inset-0 bg-ink/40" onClick={close} aria-hidden />
          <div className="relative w-full max-w-xl overflow-hidden rounded-sm border border-ink/10 bg-surface shadow-xl">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              placeholder="Search products, orders, pages…"
              className="w-full border-b border-ink/10 bg-surface px-4 py-3 font-body text-body text-ink focus:outline-none"
            />
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {items.length === 0 && (
                <li className="px-4 py-6 text-center font-mono text-caption text-ink/40">
                  {q.length >= 2 ? "No matches." : "Type to search."}
                </li>
              )}
              {items.map((it, i) => (
                <li key={it.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it.href)}
                    className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left ${
                      i === active ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="truncate font-body text-body text-ink">{it.title}</span>
                    <span className="shrink-0 font-mono text-[11px] tracking-wide text-ink/45 uppercase">
                      {it.sub}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
