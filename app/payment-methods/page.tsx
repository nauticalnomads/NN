import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Payment Methods",
  description: "The ways you can pay, and how we keep your details safe.",
  alternates: { canonical: absoluteUrl("/payment-methods") },
};

export default function PaymentMethods() {
  return (
    <Prose title="Payment Methods">
      <p>
        Checkout is handled securely by Stripe, one of the most widely trusted payment providers in
        the world. Your card details are entered on Stripe&apos;s encrypted page and are never seen
        or stored by us.
      </p>

      <h2 className="font-display text-heading text-ink">What we accept</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Visa, Mastercard, and American Express</li>
        <li>Apple Pay and Google Pay (where supported by your device)</li>
        <li>Other local methods Stripe offers in your region at checkout</li>
        <li>
          <a className="text-accent-sun hover:underline" href="/gift-cards">
            Nautical Nomads gift cards
          </a>{" "}
          — enter your code at checkout to apply the balance
        </li>
      </ul>

      <h2 className="font-display text-heading text-ink">Currency &amp; pricing</h2>
      <p>
        Prices are shown in pounds sterling (GBP) and include any applicable taxes shown at
        checkout. Your bank may apply its own conversion if you pay from another currency.
      </p>

      <h2 className="font-display text-heading text-ink">Security</h2>
      <p>
        All payments are processed over an encrypted connection and protected by 3-D Secure where
        your bank requires it. We never receive your full card number, expiry, or security code.
      </p>

      <h2 className="font-display text-heading text-ink">When you&apos;re charged</h2>
      <p>
        Payment is taken when you place your order. You&apos;ll receive a confirmation email right
        away. If an item can&apos;t be fulfilled for any reason, we&apos;ll contact you and issue a
        full refund to your original payment method.
      </p>
    </Prose>
  );
}
