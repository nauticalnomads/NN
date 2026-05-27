"use client";

import { useEffect, useState } from "react";

const THEMES = ["horizon", "tempest", "lagoon"] as const;
type Theme = (typeof THEMES)[number];

// Flips `data-theme` on <html> so the whole page re-skins via CSS variables.
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("horizon");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-ink/20">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          aria-pressed={theme === t}
          className={`px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors ${
            theme === t ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-surface-2"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
