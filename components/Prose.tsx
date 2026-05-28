import { Container } from "@/components/Container";

// Editorial text page wrapper — generous measure, brand type.
export function Prose({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Container className="py-16">
      <h1 className="font-display text-display-2 tracking-tight text-ink">{title}</h1>
      <div className="mt-8 max-w-2xl space-y-5 font-body text-body leading-relaxed text-ink/80">
        {children}
      </div>
    </Container>
  );
}
