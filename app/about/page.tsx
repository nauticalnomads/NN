import { Prose } from "@/components/Prose";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About — Coastal Lifestyle Clothing",
  description:
    "Not a surf brand, not a sailing brand. Nautical Nomads makes understated coastal clothing and swimwear for everyone drifting toward the water.",
  path: "/about",
});

export default function About() {
  return (
    <Prose title="Live by the tide">
      <p>
        We started Nautical Nomads in 2023, on a grey morning that turned good by noon. The idea was
        small: clothes you reach for without thinking, made well enough to last the season after
        next.
      </p>
      <p>
        Not a surf brand. Not a sailing brand. Something for everyone drifting toward the water —
        people who chase weather, not weekends. Long-staple cotton. Garment dye that settles in.
        Fewer pieces, made with care.
      </p>
      <p>
        We print quietly. No loud logos, no noise. Just honest type, clean photography, and a
        brushed N that we never typeset.
      </p>
    </Prose>
  );
}
