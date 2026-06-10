import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NewsletterForm } from "@/components/NewsletterForm";
import { getCmsValue } from "@/lib/cms";

type Tag = { label: string; href: string };

const DEFAULT_TAGS: Tag[] = [
  { label: "Boardshorts", href: "/collections/boardshorts" },
  { label: "Bikinis", href: "/collections/bikini-sets" },
  { label: "Flip Flops", href: "/collections/flip-flops" },
  { label: "Hoodies", href: "/collections/mens-hoodies" },
  { label: "Rashvests", href: "/collections/rashvest" },
  { label: "Swimsuits", href: "/collections/one-piece-swimsuit" },
  { label: "Bags", href: "/collections/bags-luggage" },
  { label: "Towels", href: "/collections/towels" },
  { label: "Hats", href: "/collections/hats-beanies" },
  { label: "One-Pieces", href: "/collections/one-piece-swimsuit" },
  { label: "Leggings", href: "/collections/womens-leggings" },
  { label: "Socks", href: "/collections/socks" },
];

const HELP_LINKS = [
  { label: "Order Status", href: "/account" },
  { label: "Shipping & Delivery", href: "/shipping" },
  { label: "Returns & Exchanges", href: "/returns" },
  { label: "Payment Methods", href: "/payment-methods" },
  { label: "FAQ & Contact", href: "/help" },
  { label: "Size Guide", href: "/size-guide" },
  { label: "Privacy & Data", href: "/privacy" },
];

const BRAND_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Our Story", href: "/our-story" },
  { label: "Ambassadors", href: "/ambassadors" },
  { label: "Sustainability", href: "/sustainability" },
  { label: "Blog", href: "/journal" },
  { label: "Gift Cards", href: "/gift-cards" },
  { label: "Student Discount", href: "/student-discount" },
  { label: "Careers", href: "/careers" },
];

// ── social icons ─────────────────────────────────────────────────────────────
const soc = "h-6 w-6";
const Instagram = () => (
  <svg className={soc} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const Facebook = () => (
  <svg className={soc} viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 9V7c0-.9.6-1 1-1h2V3h-3c-2.2 0-3 1.6-3 3.3V9H8v3h3v9h3v-9h2.5l.5-3h-3Z" />
  </svg>
);
const YouTube = () => (
  <svg className={soc} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23 12s0-3.2-.4-4.7c-.2-.8-.9-1.5-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4c-.8.2-1.5.9-1.7 1.7C1 8.8 1 12 1 12s0 3.2.4 4.7c.2.8.9 1.5 1.7 1.7 1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4c.8-.2 1.5-.9 1.7-1.7C23 15.2 23 12 23 12ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z" />
  </svg>
);

const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/thenauticalnomads/", Icon: Instagram },
  { label: "Facebook", href: "https://www.facebook.com/thenauticalnomad", Icon: Facebook },
  { label: "YouTube", href: "https://www.youtube.com/@nauticalnomads1", Icon: YouTube },
];

const LEGAL = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Sale", href: "/terms-of-sale" },
  { label: "Terms of Use", href: "/terms-of-use" },
  { label: "Cookie Policy", href: "/cookies" },
];

function ColHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-body text-[11px] font-semibold tracking-[0.06em] text-driftwood-tan uppercase">
      {children}
    </p>
  );
}

export async function Footer() {
  const cms = await getCmsValue<{ tags: Tag[] }>("footer.tags");
  const tags = Array.isArray(cms?.tags) && cms.tags.length ? cms.tags : DEFAULT_TAGS;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24">
      {/* §6.1 Newsletter band */}
      <div className="bg-driftwood">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-6 px-6 py-9 md:flex-row md:justify-between">
          <div className="hidden md:block">
            <Logo />
          </div>
          <div className="text-center md:text-left">
            <p className="font-body text-[24px] font-bold text-deep-ink">
              10% off your first order<span className="align-super text-[14px]">*</span>
            </p>
            <p className="mt-1 font-body text-[13px] text-driftwood-tan">
              Sign up for new arrivals and exclusive offers.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <NewsletterForm />
            <p className="mt-2 font-body text-[11px] text-driftwood-tan">
              (*) Valid for new subscribers only. One use per customer.
            </p>
          </div>
        </div>
      </div>

      {/* §6.2 Scrolling category tag row */}
      <div className="bg-deep-ink">
        <div className="mx-auto max-w-[1400px] overflow-x-auto px-6 py-4">
          <ul className="flex w-max items-center gap-3">
            {tags.map((t, i) => (
              <li key={`${t.href}-${i}`}>
                <Link
                  href={t.href}
                  className="block rounded-full border border-driftwood-tan px-4 py-2 font-body text-[12px] whitespace-nowrap text-hull-white no-underline transition-colors hover:border-terracotta hover:text-terracotta"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* §6.3 Main footer */}
      <div className="bg-deep-ink pt-12 pb-8">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-8 px-6 md:grid-cols-4">
          <div>
            <ColHeading>Follow Us</ColHeading>
            <div className="mt-4 flex gap-4">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-hull-white transition-colors hover:text-terracotta"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          <div>
            <ColHeading>Help</ColHeading>
            <ul className="mt-4 space-y-2.5">
              {HELP_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="font-body text-[14px] text-hull-white no-underline transition-colors hover:text-terracotta"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <ColHeading>Nautical Nomads</ColHeading>
            <ul className="mt-4 space-y-2.5">
              {BRAND_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="font-body text-[14px] text-hull-white no-underline transition-colors hover:text-terracotta"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* §6.4 Bottom bar */}
        <div className="mx-auto mt-10 max-w-[1400px] border-t border-driftwood-tan/20 px-6 pt-6">
          <div className="flex flex-col gap-3 font-body text-[11px] text-driftwood-tan sm:flex-row sm:items-center sm:justify-between">
            <p>© {year} Nautical Nomads</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-driftwood-tan no-underline hover:text-terracotta"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
