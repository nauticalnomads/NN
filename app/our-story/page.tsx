import { Prose } from "@/components/Prose";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Our Story",
  description:
    "How Nautical Nomads began, and why we make understated coastal lifestyle clothing and swimwear — printed quietly and made to last.",
  path: "/our-story",
});

export default function OurStory() {
  return (
    <Prose title="Our Story">
      <p>
        Nautical Nomads began with a simple frustration: most coastal clothing either shouts for
        attention or falls apart after a season of salt and sun. We wanted the opposite — quiet,
        considered pieces that look as good walking off the beach as they do anywhere else, and that
        earn their place in your bag trip after trip.
      </p>

      <h2 className="font-display text-heading text-ink">Born by the water</h2>
      <p>
        The brand grew out of long days spent in and around the sea — surfing dawn sets, swimming
        before work, drifting between harbours with no fixed plan. That rhythm shaped everything:
        the muted, sun-washed palette, the relaxed cuts, the focus on things you actually reach for
        rather than things that just look good on a hanger.
      </p>

      <h2 className="font-display text-heading text-ink">Made to order, on purpose</h2>
      <p>
        We print each piece only once it&apos;s bought. It means a little more patience between
        order and doorstep, but it also means no warehouses full of unsold stock, no mountains of
        waste, and no pressure to chase trends. You get something made for you; the planet gets a
        lighter footprint. More on that on our{" "}
        <a className="text-accent-sun hover:underline" href="/sustainability">
          sustainability page
        </a>
        .
      </p>

      <h2 className="font-display text-heading text-ink">Where we&apos;re headed</h2>
      <p>
        We&apos;re a small team and we like it that way — close to the product, close to the people
        who wear it. We&apos;re always adding designs, refining fabrics, and listening. If you have
        a thought, a request, or just want to say hello, we read every message on our{" "}
        <a className="text-accent-sun hover:underline" href="/contact">
          contact page
        </a>
        .
      </p>

      <p className="text-ink/60">Live by the tide.</p>
    </Prose>
  );
}
