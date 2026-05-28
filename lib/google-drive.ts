// Google Drive listing for the social tool. Uses a service-account key (JSON)
// stored in GOOGLE_SERVICE_ACCOUNT_JSON env. Folder id in GOOGLE_DRIVE_FOLDER_ID.
// Returns image files (publicly viewable) with thumbnails + direct view URLs.

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
};

let cachedToken: { token: string; exp: number } | null = null;

async function token(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.token;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(raw);
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

  // Sign RS256 with the service account private key (uses node:crypto).
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

export async function listImages(): Promise<DriveFile[]> {
  const t = await token();
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!t || !folder) return [];
  const q = encodeURIComponent(
    `'${folder}' in parents and mimeType contains 'image/' and trashed = false`,
  );
  const fields = encodeURIComponent("files(id,name,mimeType,thumbnailLink,webContentLink)");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=50`,
    {
      headers: { Authorization: `Bearer ${t}` },
    },
  );
  if (!res.ok) return [];
  const j = await res.json();
  return j.files ?? [];
}

// Public URL the AI can fetch the image from. uc?export=view works for files
// shared "anyone with the link".
export function driveImageUrl(id: string) {
  return `https://drive.google.com/uc?export=view&id=${id}`;
}
