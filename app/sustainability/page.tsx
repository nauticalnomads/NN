import { Prose } from "@/components/Prose";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sustainability — Slow, Made-to-Order",
  description:
    "Slow design, fewer pieces, made to last. How Nautical Nomads keeps waste low with made-to-order coastal clothing and swimwear.",
  path: "/sustainability",
});

export default function Sustainability() {
  return (
    <Prose title="Made to last">
      <p>
        We make clothes the slow way. Everything is printed to order, so we don&apos;t produce stock
        that ends up unsold and discarded — the single biggest waste in fashion.
      </p>
      <h2 className="font-display text-heading text-ink">Print on demand</h2>
      <p>
        Each piece is made when you order it. No overproduction, no warehouse landfill, less water
        and energy than mass batch printing.
      </p>
      <h2 className="font-display text-heading text-ink">Fewer, better pieces</h2>
      <p>
        We&apos;d rather you bought one thing you keep for years than five you replace each season.
        Long-staple cotton, considered fits, quiet design that doesn&apos;t date.
      </p>
      <p className="text-ink/50 italic">
        This page is a work in progress — we&apos;ll add supplier detail and materials sourcing as
        we formalise it. Honesty over greenwash.
      </p>
    </Prose>
  );
}
