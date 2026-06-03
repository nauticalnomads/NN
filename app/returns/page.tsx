import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns & Exchanges",
  description: "Our returns window and process.",
  alternates: { canonical: absoluteUrl("/returns") },
};

export default function Returns() {
  return (
    <Prose title="Returns & Exchanges">
      <p>
        If something isn&apos;t right, we&apos;ll make it right. You have 30 days from delivery to
        request a return or exchange.
      </p>
      <h2 className="font-display text-heading text-ink">Condition</h2>
      <p>
        Items should be unworn, unwashed, and in original condition with any tags attached. Because
        everything is made to order, we can&apos;t accept returns of items damaged through wear.
      </p>
      <h2 className="font-display text-heading text-ink">How to start a return</h2>
      <ol className="ml-5 list-decimal space-y-1">
        <li>Sign in and open the order in your account, or reply to your confirmation email.</li>
        <li>Tell us what you&apos;d like to return or exchange, and why.</li>
        <li>We&apos;ll send return instructions and, where applicable, a label.</li>
      </ol>
      <p>
        Refunds are issued to your original payment method once the return is received and checked.
      </p>
    </Prose>
  );
}
