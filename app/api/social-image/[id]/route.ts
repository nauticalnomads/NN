import { type NextRequest } from "next/server";
import { driveDirectImageUrl, driveRawImage } from "@/lib/google-drive";

// Public image proxy for social posts. Instagram/Facebook (via Make.com) fetch
// the post image server-side and need a stable, public URL that returns genuine
// JPEG bytes. Google Drive's own links are unreliable for third-party fetchers
// (sharing quirks, redirects, the "can't scan for viruses" HTML interstitial) —
// which surfaced as Meta errors "Invalid parameter (100)", "Media ID is not
// available (9007)", and "Only photo or video can be accepted (9004)".
//
// To be bulletproof we serve from our own domain and guarantee real image bytes:
//   1. Download the original via the service account (works even for non-public
//      files) and serve it if it's already a JPEG (what Meta wants).
//   2. Otherwise fall back to Drive's resized thumbnail, which is always a JPEG,
//      fetched server-side and re-served. Never passes HTML/non-image bytes on.
export const revalidate = 86400;

const CACHE = "public, max-age=86400, s-maxage=86400";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  // 1) Authenticated original — guaranteed real bytes. Serve directly if JPEG.
  const raw = await driveRawImage(id);
  if (raw && raw.contentType.toLowerCase().startsWith("image/jpeg")) {
    return new Response(raw.bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(raw.bytes.byteLength),
        "Cache-Control": CACHE,
      },
    });
  }

  // 2) Fall back to the resized thumbnail (always JPEG) for non-JPEG originals
  //    (PNG/WebP/HEIC — which Meta rejects) or if the raw download failed.
  const src = await driveDirectImageUrl(id, 2048);
  if (src) {
    try {
      const upstream = await fetch(src, { signal: AbortSignal.timeout(15_000) });
      const ct = (upstream.headers.get("content-type") || "").toLowerCase();
      // Guard: only pass it on if it's genuinely an image (not an HTML error page).
      if (upstream.ok && ct.startsWith("image/")) {
        const body = await upstream.arrayBuffer();
        return new Response(body, {
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(body.byteLength),
            "Cache-Control": CACHE,
          },
        });
      }
    } catch {
      /* fall through */
    }
  }

  return new Response("Image unavailable", { status: 404 });
}
