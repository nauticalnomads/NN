import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationLd } from "@/lib/structured-data";
import { allowIndexing, site } from "@/lib/site";
import { CartProvider } from "@/components/cart/CartProvider";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import { getCustomer } from "@/lib/customer";
import { getCmsValues } from "@/lib/cms";
import { NAV } from "@/lib/navigation";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  // Pre-launch default: noindex/nofollow. Flip NEXT_PUBLIC_ALLOW_INDEXING=true
  // at cutover. Belt + braces with robots.txt and the empty sitemap.
  robots: allowIndexing
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: site.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  // Mega-menu column images (CMS, §7.7) — fetched here so the client Header can
  // render them without a server import.
  const megaKeys = NAV.flatMap((n) => n.columns.map((c) => c.imageKey));
  const megaVals = await getCmsValues(megaKeys);
  const megaImages = Object.fromEntries(
    megaKeys.map((k) => [k, (megaVals[k] ?? {}) as { url?: string; alt?: string }]),
  );
  return (
    <html lang="en" data-theme="horizon" className={fontVariables}>
      <body className="flex min-h-dvh flex-col bg-surface text-ink">
        <JsonLd data={organizationLd()} />
        <CartProvider>
          <WishlistProvider signedIn={!!customer}>
            <Header megaImages={megaImages} />
            <main className="flex-1">{children}</main>
            <Footer />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
