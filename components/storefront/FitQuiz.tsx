"use client";

import { useState } from "react";

// Interactive fit finder for the size guide. Pure client-side: maps a chest
// measurement + fit preference onto the same size bands as the printed table
// (S 36–38 … 2XL 48–50). Our cut runs a little relaxed, so "closer" nudges a
// notch down and "extra relaxed" a notch up — mirroring the written advice.
const BANDS: { size: string; min: number; max: number }[] = [
  { size: "S", min: 36, max: 38 },
  { size: "M", min: 39, max: 41 },
  { size: "L", min: 42, max: 44 },
  { size: "XL", min: 45, max: 47 },
  { size: "2XL", min: 48, max: 50 },
];

type Fit = "closer" | "regular" | "relaxed";

function recommend(chest: number, fit: Fit): string | null {
  if (!Number.isFinite(chest) || chest < 30 || chest > 60) return null;
  let idx = BANDS.findIndex((b) => chest <= b.max);
  if (idx === -1) idx = BANDS.length - 1; // above the chart → biggest size
  if (chest < BANDS[0].min) idx = 0; // below the chart → smallest
  if (fit === "closer") idx = Math.max(0, idx - 1);
  if (fit === "relaxed") idx = Math.min(BANDS.length - 1, idx + 1);
  return BANDS[idx].size;
}

const FIT_OPTIONS: { value: Fit; label: string; hint: string }[] = [
  { value: "closer", label: "Closer", hint: "neater through the body" },
  { value: "regular", label: "Regular", hint: "as we cut it — easy coastal wear" },
  { value: "relaxed", label: "Extra relaxed", hint: "roomy, lived-in" },
];

export function FitQuiz() {
  const [chest, setChest] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const size = recommend(Number(chest), fit);

  return (
    <div className="not-prose mt-8 rounded-sm border border-ink/10 bg-surface-2 p-6">
      <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">Find your fit</p>

      <label className="mt-4 block">
        <span className="font-body text-body text-ink/80">Chest measurement (inches)</span>
        <input
          type="number"
          inputMode="decimal"
          min={30}
          max={60}
          value={chest}
          onChange={(e) => setChest(e.target.value)}
          placeholder="e.g. 40"
          className="mt-2 block w-32 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-body"
        />
        <span className="mt-1 block font-mono text-caption text-ink/45">
          Measure around the fullest part of your chest, tape level under the arms.
        </span>
      </label>

      <div className="mt-5">
        <span className="font-body text-body text-ink/80">How do you like it to fit?</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {FIT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setFit(o.value)}
              aria-pressed={fit === o.value}
              title={o.hint}
              className={`rounded-sm border px-4 py-2 font-mono text-caption uppercase transition-colors ${
                fit === o.value
                  ? "border-ink bg-ink text-surface"
                  : "border-ink/25 text-ink hover:border-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {chest !== "" && (
        <div className="mt-6 border-t border-ink/10 pt-5">
          {size ? (
            <p className="font-body text-body text-ink">
              We&rsquo;d suggest a{" "}
              <span className="rounded-sm bg-accent-sea/10 px-2 py-0.5 font-mono text-sub text-accent-sea">
                {size}
              </span>{" "}
              for a {FIT_OPTIONS.find((o) => o.value === fit)?.label.toLowerCase() ?? "regular"}{" "}
              fit.
            </p>
          ) : (
            <p className="font-body text-body text-ink/60">
              Enter a chest measurement between 30&Prime; and 60&Prime; — or just email us and
              we&rsquo;ll help.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
