import { renderOgImage, ogSize, ogContentType, ogAlt } from "@/lib/og-image";

// Site-wide default Open Graph image (1200×630). Routes with their own
// generateMetadata openGraph.images override this.
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage();
}
