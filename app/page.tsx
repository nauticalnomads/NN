import Link from "next/link";
import { Container } from "@/components/Container";

export default function Home() {
  return (
    <Container className="py-24 sm:py-32">
      <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">
        Established MMXXIII
      </p>
      <h1 className="mt-6 max-w-4xl font-display text-display-1 leading-[1.05] tracking-tight text-ink">
        Live by the tide.
      </h1>
      <p className="mt-8 max-w-xl font-body text-sub leading-relaxed text-ink/80">
        Coastal lifestyle, printed quietly. We dress people who chase weather, not weekends. Slow
        design, fewer pieces, built to last.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <span className="inline-flex cursor-not-allowed items-center rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase opacity-70">
          Shop — coming soon
        </span>
        <Link
          href="/styleguide"
          className="font-mono text-xs tracking-widest text-ink uppercase underline-offset-4 hover:underline"
        >
          View styleguide →
        </Link>
      </div>
    </Container>
  );
}
