import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Sale",
  description: "The terms that apply when you buy from Nautical Nomads.",
  alternates: { canonical: absoluteUrl("/terms-of-sale") },
};

export default function TermsOfSale() {
  return (
    <Prose title="Terms of Sale">
      <p>
        These terms apply to every order placed through this store. By placing an order you agree to
        them. They don&apos;t affect your statutory rights as a consumer under UK law.
      </p>

      <h2 className="font-display text-heading text-ink">Orders &amp; acceptance</h2>
      <p>
        Adding items to your bag and paying places an order, but a contract is only formed once we
        send your order confirmation email. If we can&apos;t accept your order (for example, an item
        is unavailable or there was a pricing error), we&apos;ll let you know and refund any payment
        in full.
      </p>

      <h2 className="font-display text-heading text-ink">Pricing &amp; payment</h2>
      <p>
        Prices are in pounds sterling and include any applicable taxes shown at checkout. Payment is
        taken at the time of order through Stripe. We make every effort to price items correctly,
        but if a genuine error is found we&apos;ll contact you before fulfilling the order.
      </p>

      <h2 className="font-display text-heading text-ink">Made to order</h2>
      <p>
        Our products are printed on demand once you order, so please allow a little production time
        before dispatch (see{" "}
        <a className="text-accent-sun hover:underline" href="/shipping">
          Shipping &amp; Delivery
        </a>
        ). Slight variations in colour and placement are normal for printed goods and aren&apos;t
        considered faults.
      </p>

      <h2 className="font-display text-heading text-ink">Cancellations, returns &amp; refunds</h2>
      <p>
        Under the UK Consumer Contracts Regulations you may have the right to cancel within 14 days
        of receiving your order. Beyond that, our own{" "}
        <a className="text-accent-sun hover:underline" href="/returns">
          Returns &amp; Exchanges
        </a>{" "}
        policy gives you 30 days to return unworn items in original condition. Faulty or incorrect
        items are always put right at no cost to you.
      </p>

      <h2 className="font-display text-heading text-ink">Gift cards</h2>
      <p>
        Gift cards are redeemable against orders on this site, are valid for 12 months from
        purchase, and can&apos;t be exchanged for cash. See the{" "}
        <a className="text-accent-sun hover:underline" href="/gift-cards">
          Gift Cards
        </a>{" "}
        page for full details.
      </p>

      <h2 className="font-display text-heading text-ink">Liability</h2>
      <p>
        Nothing in these terms limits our liability for death or personal injury caused by
        negligence, fraud, or any liability that can&apos;t be excluded under law. Otherwise our
        liability is limited to the value of your order.
      </p>

      <h2 className="font-display text-heading text-ink">Governing law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>

      <p className="text-ink/50">Last updated: June 2026.</p>
    </Prose>
  );
}
