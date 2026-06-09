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
        back to you — usually within a day or two.
      </p>
      <p className="font-mono text-caption tracking-wide text-ink uppercase">
        info@nauticalnomads.com
      </p>
      <p className="text-ink/60">
        For order help, include your order number — it&apos;s on your confirmation email.
      </p>
    </Prose>
  );
}
