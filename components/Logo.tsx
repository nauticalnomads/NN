// Placeholder for the hand-painted "N" monogram (brand bible §9.2: artwork,
// never typeset, never recolored/stretched). Real artwork drops in here later;
// for now a neutral mark that respects clear space and min size (24px digital).
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span aria-label="Nautical Nomads" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="font-display text-2xl font-medium tracking-tight text-ink">N</span>
      <span className="font-display text-sm tracking-[0.25em] text-ink uppercase">
        Nautical Nomads
      </span>
    </span>
  );
}
