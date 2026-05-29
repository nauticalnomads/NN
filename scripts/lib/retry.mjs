// Retry helper for transient network failures. The migration hits Cloudflare-
// fronted APIs (Shopify, Printful, Printify) which occasionally rotate TLS
// certs and serve a NotBefore-in-the-future cert for a few seconds. Without
// retry, the whole migration dies on a single CERT_NOT_YET_VALID. With it,
// we just wait a beat and try again.
//
// Classifies errors:
//   - TLS clock/cert errors           → transient, retry
//   - DNS/socket failures              → transient, retry
//   - HTTP 5xx / 408 / 429             → transient, retry
//   - Anything else                    → bubble up immediately

const TRANSIENT_TLS_CODES = new Set([
  "CERT_NOT_YET_VALID",
  "CERT_HAS_EXPIRED",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

function isTransient(err) {
  if (!err) return false;
  // node fetch wraps the underlying error in `cause`.
  const code = err.code ?? err?.cause?.code;
  if (code && TRANSIENT_TLS_CODES.has(code)) return true;
  // Plain fetch failed without code → assume transient (network blip).
  if (err.name === "TypeError" && /fetch failed/i.test(err.message)) return true;
  return false;
}

// Wraps any async operation that may throw a transient network error.
//   await retry(() => fetch(url, opts), { label: "shopify graphql" })
export async function retry(fn, { tries = 10, baseMs = 2000, label = "request" } = {}) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (attempt >= tries || !isTransient(err)) throw err;
      const delay = baseMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
      const code = err.code ?? err?.cause?.code ?? "transient";
      console.warn(`  ⚠ ${label} failed (${code}); retry ${attempt}/${tries - 1} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Convenience wrapper for HTTP fetch that also retries 5xx/408/429 responses.
export async function fetchWithRetry(url, opts = {}, retryOpts = {}) {
  const label = retryOpts.label ?? `fetch ${typeof url === "string" ? url.slice(0, 60) : "?"}`;
  return retry(
    async () => {
      const res = await fetch(url, opts);
      if (res.status >= 500 || res.status === 408 || res.status === 429) {
        const err = new Error(`${label} → HTTP ${res.status}`);
        err.code = "HTTP_" + res.status;
        // Mark as transient so isTransient() returns true.
        Object.defineProperty(err, "cause", { value: { code: "ECONNRESET" } });
        throw err;
      }
      return res;
    },
    { ...retryOpts, label },
  );
}
