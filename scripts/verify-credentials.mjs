import { getAccessToken } from "./lib/shopify.mjs";
import { printfulHeaders } from "./lib/providers.mjs";

const dim = (s) => "\x1b[2m" + s + "\x1b[0m";
const ok  = (s) => "\x1b[32m" + s + "\x1b[0m";
const bad = (s) => "\x1b[31m" + s + "\x1b[0m";

console.log("Store domain set to:", dim(process.env.SHOPIFY_STORE_DOMAIN || "(missing)"));

try {
  const tok = await getAccessToken();
  console.log(ok("✓ Shopify auth OK"), "— token", dim(tok.slice(0, 12) + "..."));
} catch (e) {
  console.log(bad("✗ Shopify auth FAILED:"), e.message);
}

try {
  const r = await fetch("https://api.printful.com/store", { headers: printfulHeaders() });
  const j = await r.json();
  if (r.ok) console.log(ok("✓ Printful auth OK"), "— store:", dim(j?.result?.name || "(unnamed)"));
  else console.log(bad("✗ Printful auth FAILED"), r.status, dim(JSON.stringify(j).slice(0, 200)));
} catch (e) { console.log(bad("✗ Printful FAILED:"), e.message); }

try {
  const r = await fetch("https://api.printify.com/v1/shops.json", {
    headers: { Authorization: "Bearer " + process.env.PRINTIFY_API_KEY },
  });
  const j = await r.json();
  if (r.ok) {
    console.log(ok("✓ Printify auth OK"), "— shops:");
    for (const s of j) console.log("   id=", s.id, " title=", dim(s.title), " sales_channel=", dim(s.sales_channel));
  } else {
    console.log(bad("✗ Printify auth FAILED"), r.status, dim(JSON.stringify(j).slice(0, 200)));
  }
} catch (e) { console.log(bad("✗ Printify FAILED:"), e.message); }
