import { type NextRequest } from "next/server";
import { driveDirectImageUrl } from "@/lib/google-drive";

// Public image proxy for social posts. Instagram/Facebook (via Make.com) fetch
// the post image server-side and need a stable, public URL that returns real
// JPEG bytes. Google Drive's own links are unreliable for third-party fetchers
// (sharing quirks, redirects, CDN flakiness) — which surfaced as Meta errors
// like "Invalid parameter (100)" and "Media ID is not available (9007)". Serving
// the bytes from our own domain removes that whole class of failure: Meta only
// ever sees a clean https://nauticalnomads.com/api/social-image/<id> JPEG.
//
// Resolves the file's resized Drive thumbnail (authenticated via the service
// account, ~2048px JPEG) and streams it back. Long cache so repeated fetches are
// cheap. No auth required (the image is about to be posted publicly anyway).
export const revalidate = 86400;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Drive file ids are URL-safe base64-ish; reject anything that isn't.
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const src = await driveDirectImageUrl(id, 2048);
  if (!src) return new Response("Image unavailable", { status: 404 });

  try {
    const upstream = await fetch(src, { signal: AbortSignal.timeout(15_000) });
    if (!upstream.ok) return new Response("Upstream error", { status: 502 });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}
