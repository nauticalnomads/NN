import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about an order, a size, or a piece? Reach us here.",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default function Contact() {
  return (
    <Prose title="Contact">
      <p>
        Questions about an order, a size, or a piece you&apos;re after? Email us and we&apos;ll get
        back to you — usually within a day or two (Monday to Friday).
      </p>

      <p className="font-mono text-caption tracking-wide text-ink uppercase">
        info@nauticalnomads.com
      </p>

      <h2 className="font-display text-heading text-ink">Help us help you faster</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>For order help, include your order number — it&apos;s on your confirmation email.</li>
        <li>For sizing, tell us your usual size and what you&apos;re between.</li>
        <li>For a return or exchange, see the steps on our Returns page first.</li>
      </ul>

      <h2 className="font-display text-heading text-ink">Quick links</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <a className="text-accent-sun hover:underline" href="/help">
            FAQ &amp; common questions
          </a>
        </li>
        <li>
          <a className="text-accent-sun hover:underline" href="/shipping">
            Shipping &amp; delivery times
          </a>
        </li>
        <li>
          <a className="text-accent-sun hover:underline" href="/returns">
            Returns &amp; exchanges
          </a>
        </li>
        <li>
          <a className="text-accent-sun hover:underline" href="/size-guide">
            Size guide
          </a>
        </li>
      </ul>
    </Prose>
  );
}
