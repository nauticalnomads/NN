// Live connection checks for the admin "Test connections" panel. Each makes a
// single authenticated request to a provider and reports whether the configured
// credentials actually work (not just whether they're filled in). Never throws —
// always resolves to a { ok, detail } result. Short timeouts so a slow/unreachable
// provider can't hang the admin request.
import { getIntegrationConfig, printfulAuthHeaders } from "@/lib/integrations";
import { getStripe } from "@/lib/stripe";

export type HealthResult = { ok: boolean; detail: string };

const TIMEOUT_MS = 12_000;

// Printful: list one sync product. Works for both account-wide and store-scoped
// tokens, so it's a reliable "is this key valid" probe.
export async function checkPrintful(): Promise<HealthResult> {
  const { printful } = await getIntegrationConfig();
  if (!printful.apiKey) return { ok: false, detail: "No API key set in Settings." };
  try {
    const res = await fetch("https://api.printful.com/sync/products?limit=1", {
      headers: await printfulAuthHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as { paging?: { total?: number } };
      const total = j?.paging?.total;
      return {
        ok: true,
        detail: `Authenticated${typeof total === "number" ? ` — ${total} products in Printful` : ""}.`,
      };
    }
    const body = (await res.text().catch(() => "")).slice(0, 120);
    return {
      ok: false,
      detail: res.status === 401 ? "Key rejected (401)." : `HTTP ${res.status} — ${body}`,
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 140) : "Request failed." };
  }
}

// Printify: list the shops the token can see, and confirm the configured Shop ID
// is among them (Printify needs both a valid key AND the right Shop ID).
export async function checkPrintify(): Promise<HealthResult> {
  const { printify } = await getIntegrationConfig();
  if (!printify.apiKey) return { ok: false, detail: "No API key set in Settings." };
  try {
    const res = await fetch("https://api.printify.com/v1/shops.json", {
      headers: { Authorization: `Bearer ${printify.apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        ok: false,
        detail: res.status === 401 ? "Key rejected (401)." : `HTTP ${res.status}.`,
      };
    }
    const shops = (await res.json().catch(() => [])) as Array<{ id: number; title?: string }>;
    const list = shops.map((s) => `${s.title ?? s.id} (${s.id})`).join(", ") || "none";
    if (!printify.shopId) {
      return { ok: false, detail: `Key works, but no Shop ID set. Available: ${list}` };
    }
    const found = shops.some((s) => String(s.id) === String(printify.shopId));
    return found
      ? { ok: true, detail: `Authenticated — shop ${printify.shopId} found.` }
      : { ok: false, detail: `Key works, but Shop ID ${printify.shopId} isn't in: ${list}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 140) : "Request failed." };
  }
}

// Stripe: retrieve the account balance — a cheap authenticated call that also
// reveals whether the key is in live or test mode.
export async function checkStripe(): Promise<HealthResult> {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, detail: "STRIPE_SECRET_KEY not set." };
  try {
    const balance = await getStripe().balance.retrieve();
    return { ok: true, detail: `Authenticated — ${balance.livemode ? "LIVE" : "test"} mode.` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 140) : "Request failed." };
  }
}
