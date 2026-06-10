import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shipping & Delivery",
  description: "How and when your made-to-order pieces ship.",
  alternates: { canonical: absoluteUrl("/shipping") },
};

export default function Shipping() {
  return (
    <Prose title="Shipping & Delivery">
      <p>
        Everything is made to order and printed when you buy it, so each piece is fresh — not pulled
        from a warehouse shelf. That means your order has two stages: <strong>production</strong>{" "}
        (printing and quality-checking your piece) and <strong>delivery</strong> (the carrier
        bringing it to you).
      </p>

      <h2 className="font-display text-heading text-ink">Production</h2>
      <p>
        Most pieces are printed and dispatched in <strong>2–5 business days</strong>. During busy
        periods (new drops, holidays like Christmas and Black Friday) production can take up to 7
        business days. You&apos;ll get an email with tracking the moment your order leaves the
        printer.
      </p>

      <h2 className="font-display text-heading text-ink">Delivery (after production)</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>UK:</strong> 3–5 business days
        </li>
        <li>
          <strong>Europe:</strong> 5–10 business days
        </li>
        <li>
          <strong>USA &amp; Canada:</strong> 5–12 business days
        </li>
        <li>
          <strong>Rest of world:</strong> 10–20 business days
        </li>
      </ul>
      <p className="text-ink/70">
        As a rule of thumb: <strong>UK orders typically arrive 5–10 business days</strong> after you
        order; international orders 1–3 weeks. Tracking is emailed automatically at dispatch so you
        can follow the journey.
      </p>

      <h2 className="font-display text-heading text-ink">
        Why made-to-order takes a little longer
      </h2>
      <p>
        Printing on demand means no warehouses of unsold stock and far less waste — but it does add
        a few production days compared with off-the-shelf retail. We think the trade is worth it,
        and we&apos;d rather be honest about timings than surprise you.
      </p>

      <h2 className="font-display text-heading text-ink">International orders</h2>
      <p>
        Orders shipped outside the UK may be subject to import VAT or duty charged by your own
        country on delivery. These are set by your local customs, not by us, and are the
        recipient&apos;s responsibility.
      </p>

      <h2 className="font-display text-heading text-ink">Order hasn&apos;t arrived?</h2>
      <p>
        Check your tracking link first — most &ldquo;missing&rdquo; parcels are simply still in
        transit. If tracking has stalled for more than 5 business days or the estimated window has
        clearly passed, email us with your order number and we&apos;ll chase it down.
      </p>
    </Prose>
  );
}
