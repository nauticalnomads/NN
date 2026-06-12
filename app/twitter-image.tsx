import { renderOgImage, ogSize, ogContentType, ogAlt } from "@/lib/og-image";

// Site-wide default Twitter/X card image — identical to the Open Graph card.
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage();
}
