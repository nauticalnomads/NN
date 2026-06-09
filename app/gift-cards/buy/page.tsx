import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { absoluteUrl } from "@/lib/site";
import { GiftCardBuyForm } from "./GiftCardBuyForm";

export const metadata: Metadata = {
  title: "Buy a Gift Card",
  description: "Send a Nautical Nomads digital gift card — redeemable on anything in the shop.",
  alternates: { canonical: absoluteUrl("/gift-cards/buy") },
};

export default function BuyGiftCard() {
  return (
    <Container className="py-16">
      <div className="grid items-start gap-12 md:grid-cols-2">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">Gift cards</p>
          <h1 className="mt-4 font-display text-display-2 tracking-tight text-deep-ink">
            Give the gift of good kit
          </h1>
          <p className="mt-4 font-body text-body leading-relaxed text-ink/75">
            Not sure of the size or the colour? Let them choose. Pick an amount, pay securely, and
            we&apos;ll email you a code to pass on.
          </p>
          <ul className="mt-6 space-y-2 font-body text-body text-ink/70">
            <li>· Redeemable against anything in the shop</li>
            <li>· Valid for 12 months from purchase</li>
            <li>· Partial balances carry over — use it across multiple orders</li>
            <li>· Delivered instantly to your inbox after payment</li>
          </ul>
        </div>

        <div className="rounded-sm border border-ink/10 bg-surface-2 p-6">
          <GiftCardBuyForm />
        </div>
      </div>
    </Container>
  );
}
