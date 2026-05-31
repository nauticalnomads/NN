import { Barlow_Condensed, Barlow, Inter } from "next/font/google";

// Roxy-inspired type system (redesign §1.2). Replaces the original
// Montserrat / DM Sans / JetBrains Mono stack.

// Display / Nav — Barlow Condensed, used ALL CAPS with wide tracking for
// nav items, section headings, large homepage titles.
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
  weight: ["600", "700"],
});

// Editorial Heading — Barlow 800 ExtraBold for hero/campaign/collection headings.
export const barlow = Barlow({
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
});

// Body / Label / Meta — Inter for body copy, labels, prices, SKUs, metadata.
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const fontVariables = `${barlowCondensed.variable} ${barlow.variable} ${inter.variable}`;
