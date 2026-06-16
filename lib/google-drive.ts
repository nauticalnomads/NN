// Google Drive listing for the social tool. Credentials come from store_settings
// (admin → Settings → Social automation) with fallback to env vars. Folder id
// and service-account JSON can be pasted in the admin without redeploying.

import { getGoogleConfig } from "@/lib/integrations";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  thumbnailLink?: string;
  webContentLink?: string;
};

let cachedToken: { token: string; exp: number } | null = null;

async function token(serviceAccountJson: string): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.token;
  if (!serviceAccountJson) return null;
  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch {
    return null;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(claim)}`;

  const { createSign } = await import("node:crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const sig = signer.sign(sa.private_key).toString("base64url");
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  cachedToken = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return cachedToken.token;
}

async function listFolder(folderId: string, t: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
  );
  const fields = encodeURIComponent(
    "nextPageToken, files(id,name,mimeType,createdTime,thumbnailLink,webContentLink)",
  );
  // Newest first, and page through the whole folder (the old single 50-file page
  // hid most of a large album). Capped at 8 pages × 200 so a huge library can't
  // run the Worker out of subrequests.
  const orderBy = encodeURIComponent("createdTime desc");
  const all: DriveFile[] = [];
  let pageToken: string | undefined;
  let auth = t;
  let retried401 = false;
  for (let i = 0; i < 8; i++) {
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${orderBy}&pageSize=200` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth}` },
      signal: AbortSignal.timeout(20_000),
    });
    // If a cached token expired mid-paging, re-mint once and retry this page.
    if (res.status === 401 && !retried401) {
      retried401 = true;
      cachedToken = null;
      const fresh = await tokenFromCache();
      if (!fresh) break;
      auth = fresh;
      i--; // redo this page with the new token
      continue;
    }
    if (!res.ok) break;
    const j = await res.json();
    all.push(...((j.files ?? []) as DriveFile[]));
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return all;
}

// Re-mint a Drive token using the configured service account (used to recover
// from a mid-request 401 when the cached token has just expired).
async function tokenFromCache(): Promise<string | null> {
  const { serviceAccountJson } = await getGoogleConfig();
  if (!serviceAccountJson) return null;
  return token(serviceAccountJson);
}

export async function listImages(): Promise<DriveFile[]> {
  const { serviceAccountJson, driveFolderId } = await getGoogleConfig();
  if (!serviceAccountJson || !driveFolderId) return [];
  const t = await token(serviceAccountJson);
  if (!t) return [];
  return listFolder(driveFolderId, t);
}

export async function listEmailCoverImages(): Promise<DriveFile[]> {
  const { serviceAccountJson, emailCoversFolderId } = await getGoogleConfig();
  if (!serviceAccountJson || !emailCoversFolderId) return [];
  const t = await token(serviceAccountJson);
  if (!t) return [];
  return listFolder(emailCoversFolderId, t);
}

// Public URL the AI can fetch the image from. uc?export=view works for files
// shared "anyone with the link".
export function driveImageUrl(id: string) {
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

// A browser-renderable thumbnail URL (works directly in <img> for files shared
// "anyone with the link"). Unlike uc?export=view, this returns a real image
// instead of a download redirect, so it shows in previews. Default ~400px wide.
export function driveThumbnailUrl(id: string, size = 400) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

// A direct, publicly-fetchable JPEG URL for a Drive file, resized to `size` px on
// the long edge. Unlike `uc?export=view` (which 302s to an HTML "can't scan for
// viruses" interstitial for large files — breaking server-side fetchers like
// Instagram's Graph API and AI vision), the googleusercontent thumbnail link is a
// real, scan-free JPEG. Returns null if Drive isn't configured / no thumbnail yet.
export async function driveDirectImageUrl(fileId: string, size = 2048): Promise<string | null> {
  const { serviceAccountJson } = await getGoogleConfig();
  if (!serviceAccountJson) return null;
  const t = await token(serviceAccountJson);
  if (!t) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
    { headers: { Authorization: `Bearer ${t}` } },
  );
  if (!res.ok) return null;
  const j = await res.json();
  const link: string | undefined = j.thumbnailLink;
  if (!link) return null;
  return link.replace(/=s\d+$/, `=s${size}`);
}

// Caption source for the vision model — same direct JPEG, sized down to keep it
// under the model's per-image limit.
export async function driveCaptionUrl(fileId: string): Promise<string | null> {
  return driveDirectImageUrl(fileId, 1600);
}
