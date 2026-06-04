"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useCart } from "@/components/cart/CartProvider";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { UTILITY_LINKS } from "@/lib/navigation";
import type { NavRoot } from "@/lib/nav-data";

// ── inline icons ─────────────────────────────────────────────────────────────
const ico = "h-[22px] w-[22px]";
const Search = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
  </svg>
);
const Person = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
  </svg>
);
const Bag = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
    <path d="M9 8a3 3 0 0 1 6 0" strokeLinecap="round" />
  </svg>
);

function CartButton() {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Bag, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className="relative text-deep-ink transition-colors hover:text-terracotta focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      <Bag />
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 font-body text-[10px] leading-none font-semibold text-hull-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}

function WishlistIcon() {
  const { count } = useWishlist();
  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist, ${count} item${count === 1 ? "" : "s"}`}
      className="relative text-deep-ink transition-colors hover:text-terracotta"
    >
      <svg
        className={ico}
        viewBox="0 0 24 24"
        fill={count > 0 ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        style={count > 0 ? { color: "var(--accent-sun)" } : undefined}
      >
        <path d="M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.6 12 20 12 20Z" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 font-body text-[10px] leading-none font-semibold text-hull-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export function Header({ nav = [] }: { nav?: NavRoot[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [activeMega, setActiveMega] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Mega-menu hover with open (200ms) + close (150ms grace) delays.
  const enterNav = (slug: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setActiveMega(slug), 200);
  };
  const leaveNav = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setActiveMega(null), 150);
  };

  const activeItem = nav.find((n) => n.slug === activeMega);

  return (
    <header className="sticky top-0 z-50">
      {/* Utility bar — desktop only (§2.1) */}
      <div className="hidden border-b border-driftwood/60 bg-hull-white md:block">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end px-6 py-2">
          <div className="flex items-center gap-5">
            {UTILITY_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-body text-[12px] text-deep-ink no-underline transition-colors hover:text-terracotta"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main header (§2.2) */}
      <div
        className={`bg-hull-white transition-shadow ${
          scrolled ? "shadow-[0_2px_12px_rgba(42,40,38,0.08)]" : "border-b border-driftwood"
        }`}
        onMouseLeave={leaveNav}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          {/* Left: hamburger (mobile) + logo */}
          <div className="flex flex-1 items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="text-deep-ink md:hidden"
            >
              <svg
                className={ico}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <Link
              href="/"
              aria-label="Nautical Nomads home"
              className="no-underline max-md:absolute max-md:left-1/2 max-md:-translate-x-1/2"
            >
              <Logo />
            </Link>
          </div>

          {/* Centre: nav (desktop) */}
          <nav className="hidden md:flex md:items-center md:gap-8">
            {nav.map((item) => (
              <div key={item.slug} onMouseEnter={() => enterNav(item.slug)}>
                <Link
                  href={`/collections/${item.slug}`}
                  className={`group relative font-body text-[14px] font-medium tracking-[0.01em] text-deep-ink no-underline ${
                    activeMega === item.slug ? "text-terracotta" : ""
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-[2px] bg-terracotta transition-all duration-200 ${
                      activeMega === item.slug ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              </div>
            ))}
          </nav>

          {/* Right: icons */}
          <div className="flex flex-1 items-center justify-end gap-4 lg:gap-5">
            <Link
              href="/shop"
              aria-label="Search"
              className="hidden text-deep-ink hover:text-terracotta md:block"
            >
              <Search />
            </Link>
            <Link
              href="/account"
              aria-label="Account"
              className="hidden text-deep-ink hover:text-terracotta md:block"
            >
              <Person />
            </Link>
            <WishlistIcon />
            <CartButton />
          </div>
        </div>

        {/* Desktop mega menu (§2.3) */}
        {activeItem && activeItem.columns.length > 0 && (
          <div
            className="absolute inset-x-0 top-full hidden border-t border-driftwood bg-hull-white shadow-[0_12px_24px_rgba(42,40,38,0.08)] md:block"
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
            }}
            onMouseLeave={leaveNav}
          >
            <div
              className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8"
              style={{
                gridTemplateColumns: `repeat(${Math.min(activeItem.columns.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {activeItem.columns.map((col) => (
                <div key={col.slug}>
                  {/* 16:9 image — the category's cover photo; Driftwood placeholder until set */}
                  <Link href={`/collections/${col.slug}`} className="block">
                    <div className="aspect-video w-full overflow-hidden rounded bg-driftwood">
                      {col.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={col.image}
                          alt={col.heading}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  </Link>
                  <Link
                    href={`/collections/${col.slug}`}
                    className="mt-3 block font-body text-[14px] font-bold text-deep-ink no-underline hover:text-terracotta"
                  >
                    {col.heading}
                  </Link>
                  <ul className="mt-2 space-y-1.5">
                    {col.links.map((l) => (
                      <li key={l.slug}>
                        <Link
                          href={`/collections/${l.slug}`}
                          className="font-body text-[13px] text-deep-ink/80 no-underline hover:text-terracotta"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile drawer (§2.4) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-deep-ink/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute top-0 left-0 flex h-full w-[86%] max-w-sm flex-col bg-hull-white shadow-xl">
            <div className="flex items-center justify-between border-b border-driftwood px-5 py-4">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="text-deep-ink"
              >
                <svg
                  className={ico}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-2">
              {nav.map((item) => {
                const open = openSection === item.slug;
                return (
                  <div key={item.slug} className="border-b border-driftwood/60">
                    <button
                      type="button"
                      onClick={() => setOpenSection(open ? null : item.slug)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between px-3 py-3.5 font-body text-[16px] font-medium text-deep-ink"
                    >
                      {item.label}
                      <svg
                        className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {open && (
                      <div className="pb-3">
                        {item.columns.map((col) => (
                          <div key={col.slug} className="px-3 py-2">
                            <Link
                              href={`/collections/${col.slug}`}
                              onClick={() => setDrawerOpen(false)}
                              className="block font-body text-[13px] font-semibold text-deep-ink no-underline"
                            >
                              {col.heading}
                            </Link>
                            {col.links.length > 0 && (
                              <ul className="mt-1.5 space-y-1.5">
                                {col.links.map((l) => (
                                  <li key={l.slug}>
                                    <Link
                                      href={`/collections/${l.slug}`}
                                      onClick={() => setDrawerOpen(false)}
                                      className="block font-body text-[14px] text-deep-ink/80 no-underline hover:text-terracotta"
                                    >
                                      {l.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-driftwood px-5 py-4">
              {UTILITY_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setDrawerOpen(false)}
                  className="block py-1.5 font-body text-[13px] text-deep-ink no-underline hover:text-terracotta"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
