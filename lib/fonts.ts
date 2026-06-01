import { Cormorant_Garamond, DM_Sans } from "next/font/google";

// Billabong-inspired type system (redesign v2 §1.2).
// Display / Hero — Cormorant Garamond: elegant editorial serif for hero
// campaign headings, large titles, collection names.
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Everything else — DM Sans: nav/UI (500), body (400), headings (700), meta.
export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const fontVariables = `${cormorant.variable} ${dmSans.variable}`;
