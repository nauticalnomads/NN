// Brand logo — the original "NAUTICAL NOMADS" mark: light, wide-tracked
// uppercase sans-serif in Deep Ink, with a larger gap between the two words.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Nautical Nomads"
      className={`inline-flex items-center font-body text-[15px] font-light tracking-[0.32em] text-ink uppercase sm:text-base ${className}`}
    >
      Nautical&nbsp;&nbsp;&nbsp;Nomads
    </span>
  );
}
