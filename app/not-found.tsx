import Link from "next/link";
import { Container } from "@/components/Container";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">404</p>
      <h1 className="mt-6 font-display text-display-2 tracking-tight text-ink">
        You drifted off the chart
      </h1>
      <p className="mt-5 max-w-md font-body text-body text-ink/70">
        This page isn&apos;t here. The current must have carried it off. Let&apos;s get you back to
        shore.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase no-underline transition-opacity hover:opacity-90"
      >
        Back to home
      </Link>
    </Container>
  );
}
