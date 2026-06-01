import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipping & Delivery",
  description: "How and when your order ships.",
  alternates: { canonical: absoluteUrl("/shipping") },
};

export default function Shipping() {
  return (
    <Prose title="Shipping & Delivery">
      <p>
        Everything is made to order and printed when you buy it, so each piece is fresh — not pulled
        from a warehouse shelf.
      </p>
      <h2 className="font-display text-heading text-ink">Processing</h2>
      <p>Most orders are produced and dispatched within 2–7 business days.</p>
      <h2 className="font-display text-heading text-ink">Delivery</h2>
      <p>
        UK: 2–4 business days after dispatch. Europe: 5–8 business days. Rest of world: 7–14
        business days. Tracking is emailed automatically the moment your order ships.
      </p>
      <h2 className="font-display text-heading text-ink">International orders</h2>
      <p>
        Orders shipped outside the UK may be subject to import VAT or duty charged by your own
        country on delivery. These are set by your local customs, not by us, and are the
        recipient&apos;s responsibility.
      </p>
    </Prose>
  );
}
