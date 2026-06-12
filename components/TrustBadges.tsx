// Reassurance row shown next to the checkout CTAs (cart + checkout) to reduce
// purchase anxiety: secure payment, easy returns, order tracking. Presentational
// only — small inline SVG icons (no icon dependency) sized to the mono caption.
const BADGES: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Secure checkout via Stripe",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    label: "30-day easy returns",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path d="M3 7h13a5 5 0 0 1 0 10h-5" />
        <path d="M6 4 3 7l3 3" />
      </svg>
    ),
  },
  {
    label: "Tracked delivery by email",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
  },
];

export function TrustBadges({ className = "" }: { className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {BADGES.map((b) => (
        <li key={b.label} className="flex items-center gap-2 font-mono text-caption text-ink/55">
          <span className="h-4 w-4 shrink-0 text-accent-sea">{b.icon}</span>
          {b.label}
        </li>
      ))}
    </ul>
  );
}
