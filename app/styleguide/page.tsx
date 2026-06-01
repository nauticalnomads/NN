import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export const metadata: Metadata = {
  title: "Styleguide",
  description: "Living reference for the Nautical Nomads design system.",
};

type Swatch = { name: string; token: string; hex: string; role: string };

const HORIZON: Swatch[] = [
  { name: "Hull White", token: "surface", hex: "#FAF6EC", role: "Primary surface" },
  { name: "Driftwood", token: "surface-2", hex: "#EFE8D8", role: "Secondary surface" },
  { name: "Deep Ink", token: "ink", hex: "#2A2826", role: "Primary text" },
  { name: "Terracotta", token: "accent-sun", hex: "#C75D3E", role: "Accent — sun (CTA)" },
  { name: "Faded Denim", token: "accent-sea", hex: "#4A6B85", role: "Accent — sea" },
  { name: "Driftwood Tan", token: "accent-sand", hex: "#B39570", role: "Accent — sand" },
];

const PALETTES = [
  { id: "horizon", label: "Horizon", note: "Primary system (brand bible §9.2)" },
  { id: "tempest", label: "Tempest", note: "Alternate — proposed, pending sign-off" },
  { id: "lagoon", label: "Lagoon", note: "Alternate — proposed, pending sign-off" },
];

const TYPE_SCALE = [
  {
    label: "Display 1",
    cls: "font-display text-display-1 tracking-tight",
    sample: "Live by the tide",
  },
  {
    label: "Display 2",
    cls: "font-display text-display-2 tracking-tight",
    sample: "Chase weather, not weekends",
  },
  { label: "Heading", cls: "font-display text-heading", sample: "Slow design, built to last" },
  { label: "Sub", cls: "font-body text-sub", sample: "Fewer pieces, made with care" },
  {
    label: "Body",
    cls: "font-body text-body",
    sample: "Fog on the harbor at 6:14 am. The coffee was bad. The water was fine.",
  },
  {
    label: "Caption",
    cls: "font-mono text-caption tracking-wide uppercase",
    sample: "NN-TEE-001 · long-staple cotton",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/10 py-14">
      <h2 className="mb-8 font-mono text-xs tracking-[0.3em] text-accent-sea uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function Styleguide() {
  return (
    <Container className="py-16">
      <header className="mb-10">
        <h1 className="font-display text-display-2 tracking-tight text-ink">Styleguide</h1>
        <p className="mt-4 max-w-xl font-body text-body text-ink/70">
          The living reference for the Nautical Nomads design system. Switch the active palette to
          re-skin the whole page via CSS variables.
        </p>
        <div className="mt-6">
          <ThemeSwitcher />
        </div>
      </header>

      <Section title="Palettes">
        <div className="grid gap-10 lg:grid-cols-3">
          {PALETTES.map((p) => (
            <div
              key={p.id}
              data-theme={p.id}
              className="rounded-sm border border-ink/10 bg-surface p-5"
            >
              <div className="mb-4">
                <h3 className="font-display text-heading text-ink">{p.label}</h3>
                <p className="font-mono text-caption text-ink/50 uppercase">{p.note}</p>
              </div>
              <div className="space-y-2">
                {(
                  [
                    "surface",
                    "surface-2",
                    "ink",
                    "accent-sun",
                    "accent-sea",
                    "accent-sand",
                  ] as const
                ).map((token) => (
                  <div key={token} className="flex items-center gap-3">
                    <span
                      className="h-9 w-9 shrink-0 rounded-sm border border-ink/15"
                      style={{ backgroundColor: `var(--${token})` }}
                    />
                    <span className="font-mono text-caption text-ink/70">{token}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <h3 className="mb-3 font-mono text-caption tracking-wide text-ink/60 uppercase">
            Horizon tokens (reference hexes)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HORIZON.map((s) => (
              <div
                key={s.token}
                className="flex items-center gap-3 rounded-sm border border-ink/10 p-3"
              >
                <span
                  className="h-12 w-12 shrink-0 rounded-sm border border-ink/15"
                  style={{ backgroundColor: `var(--${s.token})` }}
                />
                <div>
                  <p className="font-body text-body text-ink">{s.name}</p>
                  <p className="font-mono text-caption text-ink/50">
                    {s.hex} · {s.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-8">
          {TYPE_SCALE.map((t) => (
            <div key={t.label} className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-baseline">
              <span className="font-mono text-caption tracking-wide text-ink/50 uppercase">
                {t.label}
              </span>
              <p className={`${t.cls} text-ink`}>{t.sample}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <button className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase transition-opacity hover:opacity-90">
            Primary
          </button>
          <button className="rounded-sm border border-ink px-6 py-3 font-mono text-xs tracking-widest text-ink uppercase transition-colors hover:bg-ink hover:text-surface">
            Secondary
          </button>
          <button className="font-mono text-xs tracking-widest text-ink uppercase underline-offset-4 hover:underline">
            Text link →
          </button>
        </div>
      </Section>

      <Section title="Fonts">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-display text-heading text-ink">Cormorant Garamond</p>
            <p className="font-body text-caption text-ink/50 uppercase">
              Display / hero / editorial
            </p>
          </div>
          <div>
            <p className="font-body text-heading text-ink">DM Sans</p>
            <p className="font-body text-caption text-ink/50 uppercase">
              Nav · body · headings · meta
            </p>
          </div>
        </div>
      </Section>
    </Container>
  );
}
