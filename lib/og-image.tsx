import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

// Shared generator for the site-wide default social share card, used by both
// app/opengraph-image.tsx and app/twitter-image.tsx so the two stay identical.
// Rendered dynamically (next/og / Satori) in brand colours — no binary asset to
// commit or keep in sync. Pages with their own image (products, collections,
// journal posts) still override this per-route.
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = `${site.name} — ${site.tagline}`;

// Brand palette (mirrors the "horizon" theme tokens in app/globals.css).
const HULL_WHITE = "#faf6ec";
const DEEP_INK = "#2a2826";
const TERRACOTTA = "#c75d3e";

export function renderOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: HULL_WHITE,
        position: "relative",
      }}
    >
      {/* Top accent rule */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 12,
          backgroundColor: TERRACOTTA,
        }}
      />
      <div
        style={{
          fontSize: 84,
          fontWeight: 600,
          letterSpacing: 18,
          color: DEEP_INK,
          textTransform: "uppercase",
          display: "flex",
        }}
      >
        {site.name}
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 38,
          color: TERRACOTTA,
          display: "flex",
        }}
      >
        {site.tagline}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 48,
          fontSize: 22,
          letterSpacing: 6,
          color: DEEP_INK,
          opacity: 0.55,
          textTransform: "uppercase",
          display: "flex",
        }}
      >
        Est. {site.established}
      </div>
    </div>,
    { ...ogSize },
  );
}
