"use client";

import { useState } from "react";

export type Zone = { name: string; countries: string[]; rate: number };

// Editable list of flat-zone shipping rates. Drives the flat-fallback that
// kicks in when POD live quotes fail and the only source of rates in flat mode.
// Country use ISO-2 codes (or "*" as the catch-all). Rates in store currency.
export function ZoneEditor({ initial }: { initial: Zone[] }) {
  const [zones, setZones] = useState<Zone[]>(initial.length ? initial : [defaultZone()]);

  function update(i: number, patch: Partial<Zone>) {
    setZones((curr) => curr.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));
  }
  function add() {
    setZones((curr) => [...curr, defaultZone()]);
  }
  function remove(i: number) {
    setZones((curr) => curr.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input type="hidden" name="flat_zones" value={JSON.stringify(zones)} />
      <div className="overflow-hidden rounded-sm border border-ink/15">
        <table className="w-full text-left">
          <thead className="bg-surface-2 font-mono text-caption tracking-wide text-ink/60 uppercase">
            <tr>
              <th className="px-3 py-2">Zone name</th>
              <th className="px-3 py-2">Countries (ISO-2, comma-sep · * for any)</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => (
              <tr key={i} className="border-t border-ink/10 align-top">
                <td className="px-3 py-2">
                  <input
                    value={z.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="w-full rounded-sm border border-ink/20 bg-surface px-2 py-1 font-body text-body"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={z.countries.join(", ")}
                    onChange={(e) =>
                      update(i, {
                        countries: e.target.value
                          .split(",")
                          .map((s) => s.trim().toUpperCase())
                          .filter(Boolean),
                      })
                    }
                    placeholder="GB, IE, FR"
                    className="w-full rounded-sm border border-ink/20 bg-surface px-2 py-1 font-mono text-caption"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={Number.isFinite(z.rate) ? z.rate : 0}
                    onChange={(e) => update(i, { rate: Number(e.target.value) || 0 })}
                    className="w-24 rounded-sm border border-ink/20 bg-surface px-2 py-1 text-right font-mono text-body"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="font-mono text-caption tracking-wide text-ink/50 uppercase underline-offset-4 hover:text-accent-sun hover:underline"
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-3 font-mono text-caption tracking-widest text-accent-sea uppercase underline-offset-4 hover:underline"
      >
        + add zone
      </button>
      <p className="mt-3 font-mono text-caption text-ink/50">
        First match wins by country code. Add a zone with countries <code>*</code> as the catch-all
        for the rest of the world.
      </p>
    </div>
  );
}

function defaultZone(): Zone {
  return { name: "", countries: [], rate: 0 };
}
