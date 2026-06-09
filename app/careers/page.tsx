import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Careers",
  description: "Work with Nautical Nomads.",
  alternates: { canonical: absoluteUrl("/careers") },
};

export default function Careers() {
  return (
    <Prose title="Careers">
      <p>
        We&apos;re a small, sea-minded team building a brand we&apos;re proud of — slowly, and
        properly. We don&apos;t have a wall of open roles, but we&apos;re always glad to hear from
        people who love the water and care about doing good work.
      </p>

      <h2 className="font-display text-heading text-ink">Open roles</h2>
      <p className="text-ink/60">
        Nothing live right now — but that changes as we grow. Check back, or send a speculative note
        below.
      </p>

      <h2 className="font-display text-heading text-ink">Areas we tend to grow in</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Design &amp; product (apparel, print, brand)</li>
        <li>Content, photography, and social</li>
        <li>Customer care and operations</li>
        <li>
          Ambassadors &amp; community (see our{" "}
          <a className="text-accent-sun hover:underline" href="/ambassadors">
            ambassadors page
          </a>
          )
        </li>
      </ul>

      <h2 className="font-display text-heading text-ink">Get in touch</h2>
      <p>
        Tell us who you are, what you&apos;d love to do, and why the sea matters to you. Email{" "}
        <span className="font-mono text-caption tracking-wide text-ink uppercase">
          info@nauticalnomads.com
        </span>{" "}
        with &ldquo;Careers&rdquo; in the subject line and a link to your work or CV.
      </p>
    </Prose>
  );
}
