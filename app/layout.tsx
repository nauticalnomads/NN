import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nautical Nomads — Live by the tide",
    template: "%s · Nautical Nomads",
  },
  description:
    "Coastal lifestyle clothing, printed quietly. For everyone drifting toward the water.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="horizon" className={fontVariables}>
      <body className="flex min-h-dvh flex-col bg-surface text-ink">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
