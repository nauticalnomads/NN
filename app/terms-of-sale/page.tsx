import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Sale",
  description: "The terms that apply when you buy from us.",
  alternates: { canonical: absoluteUrl("/terms-of-sale") },
};

export default function TermsOfSale() {
  return (
    <Prose title="Terms of Sale">
      <p className="text-ink/50 italic">
        Placeholder copy — to be replaced with final, reviewed terms before launch.
      </p>
      <p>
        These terms apply to every order placed through this store. By placing an order you agree to
        them.
      </p>
      <p>
        Prices are shown in pounds sterling and include any applicable taxes shown at checkout.
        Orders are confirmed once payment is taken and you receive a confirmation email.
      </p>
      <p>
        Items are made to order. Where an item can&apos;t be fulfilled, we&apos;ll contact you and
        issue a full refund.
      </p>
      <p>Returns and refunds are governed by our Returns &amp; Exchanges policy.</p>
    </Prose>
  );
}
