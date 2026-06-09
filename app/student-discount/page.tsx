import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Student Discount",
  description: "10% off for students, all year round.",
  alternates: { canonical: absoluteUrl("/student-discount") },
};

export default function StudentDiscount() {
  return (
    <Prose title="Student Discount">
      <p>
        Student budgets are tight and good kit shouldn&apos;t be out of reach — so students get
        <strong> 10% off</strong> everything in the shop, all year round.
      </p>

      <h2 className="font-display text-heading text-ink">How it works</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Email us from your student (.ac.uk or .edu) address, or include proof of enrolment.</li>
        <li>We&apos;ll reply with a single-use discount code for 10% off your order.</li>
        <li>Enter the code at checkout — it applies to the whole bag.</li>
      </ol>

      <h2 className="font-display text-heading text-ink">The small print</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          One code per customer; can&apos;t be combined with other offers or gift-card top-ups.
        </li>
        <li>Valid while you&apos;re enrolled in full- or part-time study.</li>
        <li>We may ask to re-verify from time to time.</li>
      </ul>

      <p className="text-ink/70">
        Ready to claim it? Email{" "}
        <span className="font-mono text-caption tracking-wide text-ink uppercase">
          info@nauticalnomads.com
        </span>{" "}
        with the subject &ldquo;Student discount&rdquo; and we&apos;ll sort you out.
      </p>
    </Prose>
  );
}
