// Shared secret/token verification for inbound webhooks + cron, written for the
// Cloudflare Workers runtime (no node:crypto). Constant-time within a fixed
// length to avoid leaking the secret byte-by-byte via timing.
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Fail CLOSED: a request is authorized only when the secret is configured AND
// the provided token matches it. An unset secret rejects everything (rather
// than the old `if (secret && ...)` which skipped the check entirely).
export function tokenAuthorized(
  secret: string | null | undefined,
  provided: string | null | undefined,
): boolean {
  if (!secret) return false;
  return safeEqual(provided, secret);
}
