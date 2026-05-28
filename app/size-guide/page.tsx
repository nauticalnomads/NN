import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Size Guide",
  description: "Measurements for our tees, sweats and hoodies. Cut a little relaxed.",
  alternates: { canonical: absoluteUrl("/size-guide") },
};

const ROWS = [
  ["S", "36–38", "27"],
  ["M", "39–41", "28"],
  ["L", "42–44", "29"],
  ["XL", "45–47", "30"],
  ["2XL", "48–50", "31"],
];

export default function SizeGuide() {
  return (
    <Prose title="Size Guide">
      <p>
        Our pieces are cut a little relaxed through the body. If you&apos;re between sizes or like a
        closer fit, size down. Measurements are in inches and approximate.
      </p>
      <table className="w-full border-collapse font-mono text-caption text-ink">
        <thead>
          <tr className="border-b border-ink/20 text-left uppercase tracking-wide text-ink/60">
            <th className="py-2">Size</th>
            <th className="py-2">Chest</th>
            <th className="py-2">Length</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([size, chest, length]) => (
            <tr key={size} className="border-b border-ink/10">
              <td className="py-2">{size}</td>
              <td className="py-2">{chest}</td>
              <td className="py-2">{length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-ink/60">
        Specific pieces note their own fit on the product page. When in doubt, email us.
      </p>
    </Prose>
  );
}
