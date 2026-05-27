import { Container } from "@/components/Container";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/10 bg-surface-2">
      <Container className="flex flex-col gap-2 py-10">
        <p className="font-display text-lg tracking-tight text-ink">Live by the tide.</p>
        <p className="font-mono text-xs tracking-wide text-ink/60 uppercase">
          Nautical Nomads · Established MMXXIII
        </p>
      </Container>
    </footer>
  );
}
