import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "How we ship, what it costs, and how returns work.",
  alternates: { canonical: absoluteUrl("/shipping-returns") },
};

export default function ShippingReturns() {
  return (
    <Prose title="Shipping & Returns">
      <h2 className="font-display text-heading text-ink">Shipping</h2>
      <p>
        Our pieces are made to order and printed by our production partners, then sent straight to
        you. Most orders ship within a few days; you&apos;ll get a tracking number by email when
        yours is on its way.
      </p>

      <h2 className="pt-4 font-display text-heading text-ink">Import VAT &amp; duty</h2>
      <p className="rounded-sm border border-accent-sea/30 bg-surface-2 p-5 text-ink/80">
        Ordering from outside the UK? Your country may charge import VAT or duty when the parcel
        arrives. That charge is set by your local customs, is separate from what you pay us, and is
        the customer&apos;s responsibility. We don&apos;t mark parcels as gifts.
      </p>

      <h2 className="pt-4 font-display text-heading text-ink">Returns</h2>
      <p>
        If something isn&apos;t right, get in touch within 30 days of delivery and we&apos;ll sort
        it. Items should be unworn and unwashed. Because pieces are made to order, we handle returns
        case by case — email us and we&apos;ll look after you.
      </p>
    </Prose>
  );
}
