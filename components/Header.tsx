"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useCart } from "@/components/cart/CartProvider";
import { NAV, UTILITY_LINKS } from "@/lib/navigation";

// ── inline icons (no icon lib) ───────────────────────────────────────────────
const ico = "h-[22px] w-[22px]";
function SearchIcon() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 20s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.6 12 20 12 20Z" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
      <path d="M9 8a3 3 0 0 1 6 0" strokeLinecap="round" />
    </svg>
  );
}

function IconButton({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="text-deep-ink transition-colors hover:text-terracotta focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      {children}
    </Link>
  );
}

function CartButton() {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Bag, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className="relative text-deep-ink transition-colors hover:text-terracotta focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      <BagIcon />
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 font-body text-[10px] leading-none font-semibold text-hull-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <header className="sticky top-0 z-50">
      {/* Utility bar — hidden on mobile (§2.1) */}
      <div className="hidden bg-deep-ink md:block">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-6 px-6 py-2">
          {UTILITY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-body text-[12px] font-medium tracking-[0.05em] text-hull-white/90 uppercase no-underline transition-colors hover:text-hull-white"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main header (§2.2) */}
      <div
        className={`border-b border-driftwood bg-hull-white transition-shadow ${
          scrolled ? "shadow-[0_2px_12px_rgba(42,40,38,0.08)]" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          {/* Zone 1 — logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="text-deep-ink lg:hidden"
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
            <Link href="/" className="no-underline" aria-label="Nautical Nomads home">
              <Logo />
            </Link>
          </div>

          {/* Zone 2 — primary nav (desktop) */}
          <nav className="hidden lg:flex lg:items-center lg:gap-9">
            {NAV.map((item) => (
              <Link
                key={item.slug}
                href={`/collections/${item.slug}`}
                className="group relative font-display text-[14px] font-bold tracking-[0.08em] text-deep-ink uppercase no-underline"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-terracotta transition-all duration-200 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          {/* Zone 3 — icons */}
          <div className="flex items-center gap-4 lg:gap-5">
            <IconButton label="Search" href="/shop">
              <SearchIcon />
            </IconButton>
            <IconButton label="Account" href="/account">
              <PersonIcon />
            </IconButton>
            <IconButton label="Wishlist" href="/wishlist">
              <HeartIcon />
            </IconButton>
            <CartButton />
          </div>
        </div>
      </div>

      {/* Mobile drawer (§2.2) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-deep-ink/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute top-0 left-0 flex h-full w-[84%] max-w-sm flex-col bg-hull-white shadow-xl">
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
              {NAV.map((item) => {
                const open = openSection === item.slug;
                return (
                  <div key={item.slug} className="border-b border-driftwood/60">
                    <button
                      type="button"
                      onClick={() => setOpenSection(open ? null : item.slug)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between px-3 py-3.5 font-display text-[16px] font-bold tracking-[0.08em] text-deep-ink uppercase"
                    >
                      {item.label}
                      <span className={`transition-transform ${open ? "rotate-45" : ""}`}>
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                      </span>
                    </button>
                    {open && (
                      <div className="pb-3">
                        {item.columns.map((col) => (
                          <div key={col.slug} className="px-3 py-2">
                            <Link
                              href={`/collections/${col.slug}`}
                              onClick={() => setDrawerOpen(false)}
                              className="block font-body text-[13px] font-semibold tracking-[0.04em] text-deep-ink uppercase no-underline"
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
                  className="block py-1.5 font-body text-[13px] font-medium tracking-[0.05em] text-deep-ink uppercase no-underline hover:text-terracotta"
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
