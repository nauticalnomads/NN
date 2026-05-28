const dim = (s) => "\x1b[2m" + s + "\x1b[0m";
const ok  = (s) => "\x1b[32m" + s + "\x1b[0m";
const bad = (s) => "\x1b[31m" + s + "\x1b[0m";

// Try Shopify subdomain variants — OAuth endpoint returns 404 when the shop
// handle doesn't exist, so we can detect the real handle by error shape.
const candidates = [
  "nauticalnomads.myshopify.com",
  "nautical-nomads.myshopify.com",
  "nauticalnomads-clothing.myshopify.com",
  "nautical-nomads-clothing.myshopify.com",
  "nauticalnomads-store.myshopify.com",
  "nauticalnomads1.myshopify.com",
  "nauticalnomads2.myshopify.com",
  "nautical-nomads-2.myshopify.com",
];
console.log("Shopify subdomain probe (POST /admin/oauth/access_token):");
for (const c of candidates) {
  try {
    const r = await fetch(`https://${c}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });
    const text = await r.text();
    const status = r.status;
    let mark = bad(`✗ ${status}`);
    // 200 = real handle + valid secret. 401/403 = real handle, wrong secret.
    if (status === 200) mark = ok(`✓ ${status} REAL + VALID`);
    else if (status === 401 || status === 403) mark = ok(`◐ ${status} REAL HANDLE (auth issue)`);
    console.log("  ", mark.padEnd(38), c, "  ", dim(text.slice(0, 100)));
  } catch (e) {
    console.log("  ", bad("✗ ERR"), c, e.message);
  }
}

// Also try resolving the customer-facing domain: Shopify exposes the canonical
// myshopify handle in the response headers / on the homepage.
console.log("\nProbing nauticalnomads.com to find its canonical .myshopify.com:");
try {
  const r = await fetch("https://nauticalnomads.com", { redirect: "manual" });
  console.log("   status:", r.status);
  for (const [k, v] of r.headers.entries()) {
    if (/shop|x-shopid|x-shardid|powered/i.test(k)) console.log("   ", k, "=", v);
  }
  const body = await fetch("https://nauticalnomads.com").then((x) => x.text()).catch(() => "");
  const m = body.match(/([a-z0-9-]+)\.myshopify\.com/i);
  if (m) console.log("   homepage references:", ok(m[0]));
} catch (e) { console.log("   ", bad(e.message)); }

// Printful — new accounts need store_id; list stores first.
console.log("\nPrintful stores:");
try {
  const r = await fetch("https://api.printful.com/stores", {
    headers: { Authorization: "Bearer " + process.env.PRINTFUL_API_KEY },
  });
  const j = await r.json();
  if (r.ok) {
    for (const s of j.result ?? []) console.log("   id=", s.id, " name=", dim(s.name), " platform=", dim(s.type));
  } else {
    console.log("   ", bad("FAILED"), r.status, dim(JSON.stringify(j).slice(0, 300)));
  }
} catch (e) { console.log("   ", bad(e.message)); }
