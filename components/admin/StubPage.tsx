// Minimal placeholder for admin sections whose full UI is built in a later
// session. The role guard is real — the page just doesn't have all its widgets
// yet. Lets us validate auth/nav end-to-end before each section is fleshed out.
export function StubPage({
  title,
  session,
  blurb,
}: {
  title: string;
  session: string;
  blurb: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">{session}</p>
      <h1 className="mt-4 font-display text-display-2 tracking-tight text-ink">{title}</h1>
      <p className="mt-6 font-body text-body leading-relaxed text-ink/70">{blurb}</p>
    </div>
  );
}
