import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { absoluteUrl } from "@/lib/site";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = {
  title: "Careers",
  description: "Work with Nautical Nomads — apply with your CV and cover letter.",
  alternates: { canonical: absoluteUrl("/careers") },
};

export default function Careers() {
  return (
    <Container className="py-16">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">Careers</p>
          <h1 className="mt-4 font-display text-display-2 tracking-tight text-deep-ink">
            Work by the tide
          </h1>
          <p className="mt-4 font-body text-body leading-relaxed text-ink/75">
            We&apos;re a small, sea-minded team building a brand we&apos;re proud of — slowly, and
            properly. We don&apos;t have a wall of open roles, but we&apos;re always glad to hear
            from people who love the water and care about doing good work.
          </p>

          <h2 className="mt-8 font-display text-heading text-ink">Areas we tend to grow in</h2>
          <ul className="mt-3 space-y-2 font-body text-body text-ink/70">
            <li>· Design &amp; product (apparel, print, brand)</li>
            <li>· Content, photography, and social</li>
            <li>· Customer care and operations</li>
            <li>
              · Ambassadors &amp; community — see our{" "}
              <a className="text-accent-sun hover:underline" href="/ambassadors">
                ambassadors page
              </a>
            </li>
          </ul>

          <p className="mt-8 font-body text-caption text-ink/50">
            Prefer email? Send everything to{" "}
            <span className="font-mono uppercase">info@nauticalnomads.com</span> with
            &ldquo;Careers&rdquo; in the subject line.
          </p>
        </div>

        <div className="rounded-sm border border-ink/10 bg-surface-2 p-6 sm:p-8">
          <h2 className="font-display text-heading text-ink">Apply</h2>
          <p className="mt-2 mb-6 font-body text-caption text-ink/60">
            Attach your CV and (optionally) a cover letter, and tell us who you are.
          </p>
          <ApplyForm />
        </div>
      </div>
    </Container>
  );
}
