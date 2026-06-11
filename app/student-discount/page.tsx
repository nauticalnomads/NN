import { Container } from "@/components/Container";
import { pageMetadata } from "@/lib/seo";
import { RevealForm } from "./RevealForm";

export const metadata = pageMetadata({
  title: "Student Discount — 5% Off Year-Round",
  description:
    "Students get 5% off Nautical Nomads coastal clothing all year round. Verify with your university email and start saving today.",
  path: "/student-discount",
});

export default function StudentDiscount() {
  return (
    <Container className="py-16">
      <div className="grid items-start gap-12 md:grid-cols-2">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">Students</p>
          <h1 className="mt-4 font-display text-display-2 tracking-tight text-deep-ink">
            5% off, all year round
          </h1>
          <p className="mt-4 font-body text-body leading-relaxed text-ink/75">
            Student budgets are tight and good kit shouldn&apos;t be out of reach. Pop in your
            university email, get your code instantly, and use it on anything in the shop.
          </p>
          <ul className="mt-6 space-y-2 font-body text-body text-ink/70">
            <li>· Works on everything, every day</li>
            <li>· Instant — no sign-up, no third-party verification</li>
            <li>· One use per order; not combinable with other offers</li>
          </ul>
          <p className="mt-6 font-body text-caption text-ink/50">
            No university email but still studying? Email{" "}
            <span className="font-mono uppercase">info@nauticalnomads.com</span> with proof of
            enrolment and we&apos;ll send you the code.
          </p>
        </div>
        <RevealForm />
      </div>
    </Container>
  );
}
