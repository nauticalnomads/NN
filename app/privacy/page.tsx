import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Nautical Nomads collects, uses, and protects your personal data.",
  alternates: { canonical: absoluteUrl("/privacy") },
};

export default function Privacy() {
  return (
    <Prose title="Privacy Policy">
      <p className="text-ink/50">
        This policy explains what personal data we collect, why, and your rights over it. It is
        written to align with the UK GDPR and the Data Protection Act 2018.
      </p>

      <h2 className="font-display text-heading text-ink">Who we are</h2>
      <p>
        Nautical Nomads (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs this online store. For any privacy
        question, or to exercise your rights, contact{" "}
        <span className="font-mono text-caption tracking-wide text-ink uppercase">
          info@nauticalnomads.com
        </span>
        . We are the data controller for the personal data described here.
      </p>

      <h2 className="font-display text-heading text-ink">What we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Contact &amp; delivery details: name, email, shipping address.</li>
        <li>Order information: items bought, order history, and correspondence with us.</li>
        <li>Payment confirmation from Stripe (we never receive your full card number).</li>
        <li>Marketing preferences, if you opt in to our newsletter.</li>
        <li>Basic technical data needed to run the site securely (e.g. session cookies).</li>
      </ul>

      <h2 className="font-display text-heading text-ink">How we use it &amp; our lawful basis</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          To process and deliver your order, and provide support —{" "}
          <em>performance of a contract</em>.
        </li>
        <li>
          To send order and shipping updates — <em>performance of a contract</em>.
        </li>
        <li>
          To send marketing emails where you&apos;ve opted in — <em>consent</em>, withdrawable at
          any time.
        </li>
        <li>
          To prevent fraud, keep the site secure, and meet our legal and tax obligations —{" "}
          <em>legitimate interests</em> and <em>legal obligation</em>.
        </li>
      </ul>

      <h2 className="font-display text-heading text-ink">Who we share it with</h2>
      <p>
        We do not sell your data. We share it only with the providers needed to run the shop and
        fulfil your order, acting on our instructions:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Stripe — payment processing.</li>
        <li>Printful / Printify — print-on-demand fulfilment and shipping.</li>
        <li>Resend — transactional and (if opted in) marketing email.</li>
        <li>Supabase &amp; Cloudflare — secure hosting and data storage.</li>
      </ul>
      <p>
        Some providers may process data outside the UK; where they do, appropriate safeguards (such
        as Standard Contractual Clauses) are in place.
      </p>

      <h2 className="font-display text-heading text-ink">How long we keep it</h2>
      <p>
        We keep order records for as long as needed to provide the service and to meet legal and
        accounting requirements (typically up to 6 years for tax). Marketing data is kept until you
        unsubscribe.
      </p>

      <h2 className="font-display text-heading text-ink">Your rights</h2>
      <p>
        You have the right to access, correct, delete, or port your data, to object to or restrict
        processing, and to withdraw consent at any time. To make a request, email us at the address
        above. You also have the right to complain to the UK Information Commissioner&apos;s Office
        (ico.org.uk).
      </p>

      <h2 className="font-display text-heading text-ink">Cookies</h2>
      <p>
        We use a small number of essential cookies — see our{" "}
        <a className="text-accent-sun hover:underline" href="/cookies">
          Cookie Policy
        </a>{" "}
        for details.
      </p>

      <p className="text-ink/50">Last updated: June 2026.</p>
    </Prose>
  );
}
