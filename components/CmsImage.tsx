import Image from "next/image";

// Renders a CMS image, or a warm Driftwood placeholder when no URL is set
// (redesign v2 — "never broken image icons"). Used across homepage + mega menu.
export function CmsImage({
  url,
  alt,
  className = "",
  sizes,
  priority = false,
}: {
  url?: string | null;
  alt?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!url) {
    return <div className={`bg-driftwood ${className}`} aria-hidden />;
  }
  return (
    <Image
      src={url}
      alt={alt ?? ""}
      fill
      sizes={sizes ?? "100vw"}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}
