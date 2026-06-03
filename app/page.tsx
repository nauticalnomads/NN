import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { getFeaturedProducts } from "@/lib/queries";
import { getCmsValues } from "@/lib/cms";
import { websiteLd } from "@/lib/structured-data";
import { absoluteUrl, site } from "@/lib/site";
import {
  HeroCollage,
  EditorialBanner,
  CampaignTitle,
  PhotoStrip,
  CategoryTiles,
  type HeroData,
  type BannerColumn,
  type Tile,
} from "@/components/home/sections";
import { FeaturedCarousel } from "@/components/home/FeaturedCarousel";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: absoluteUrl("/"),
  },
};

export default async function Home() {
  const [featured, cms] = await Promise.all([
    getFeaturedProducts(12),
    getCmsValues([
      "home.hero",
      "home.banner",
      "home.campaign",
      "home.strip",
      "home.tiles",
      "home.carousel1",
    ]),
  ]);

  const hero = (cms["home.hero"] ?? {}) as HeroData;
  const banner = ((cms["home.banner"] as { columns?: BannerColumn[] })?.columns ??
    []) as BannerColumn[];
  const campaign = (cms["home.campaign"] ?? {}) as {
    heading?: string;
    ctaText?: string;
    ctaUrl?: string;
  };
  const strip = ((cms["home.strip"] as { images?: { url?: string; alt?: string }[] })?.images ??
    []) as { url?: string; alt?: string }[];
  const tiles = ((cms["home.tiles"] as { tiles?: Tile[] })?.tiles ?? []) as Tile[];
  const carousel1 = (cms["home.carousel1"] ?? {}) as { heading?: string };

  return (
    <>
      <JsonLd data={websiteLd()} />
      <HeroCollage data={hero} />
      <FeaturedCarousel heading={carousel1.heading || "New Arrivals"} products={featured} />
      <EditorialBanner columns={banner} />
      <CampaignTitle
        heading={campaign.heading}
        ctaText={campaign.ctaText}
        ctaUrl={campaign.ctaUrl}
      />
      <PhotoStrip images={strip} />
      <CategoryTiles tiles={tiles} />
    </>
  );
}
