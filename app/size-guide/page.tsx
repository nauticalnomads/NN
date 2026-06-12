import { Prose } from "@/components/Prose";
import { FitQuiz } from "@/components/storefront/FitQuiz";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Size Guide — Tees, Sweats & Hoodies",
  description:
    "Find your fit. Measurements for Nautical Nomads tees, sweats and hoodies — cut a little relaxed for easy coastal wear.",
  path: "/size-guide",
});

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
      <FitQuiz />
    </Prose>
  );
}
