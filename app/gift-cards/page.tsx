import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gift Cards",
  description: "Give the gift of good clothes.",
  alternates: { canonical: absoluteUrl("/gift-cards") },
};

export default function GiftCards() {
  return (
    <Container className="py-16">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-driftwood">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-3xl text-deep-ink/30">Nautical Nomads</span>
          </div>
        </div>
        <div>
          <h1 className="font-display text-display-2 font-semibold tracking-tight text-deep-ink">
            Gift cards
          </h1>
          <p className="mt-4 font-body text-body leading-relaxed text-ink/75">
            Not sure of the size or the colour? Let them choose. Digital gift cards arrive by email
            the moment they&apos;re paid for, are valid for 12 months, and are good for anything in
            the shop — with any unused balance carried over.
          </p>
          <Link
            href="/gift-cards/buy"
            className="mt-8 inline-block rounded-sm bg-accent-sun px-6 py-3 font-body text-[14px] font-medium text-surface transition-opacity hover:opacity-90"
          >
            Buy a gift card
          </Link>
          <p className="mt-3 font-body text-caption text-ink/50">
            Have a code? Enter it at checkout to apply the balance.
          </p>
        </div>
      </div>
    </Container>
  );
}
