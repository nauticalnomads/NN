import { Montserrat, DM_Sans, JetBrains_Mono } from "next/font/google";

// Display — headlines, lookbook covers, generous tracking (brand bible §9.2)
export const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  style: ["normal", "italic"],
});

// Body — DM Sans 300–700
export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["300", "400", "500", "700"],
});

// Mono — tags, specs, SKUs, metadata ("small honest type")
export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = `${montserrat.variable} ${dmSans.variable} ${jetBrainsMono.variable}`;
