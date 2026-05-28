// Shopify Admin API client — uses the OAuth client credentials grant.
// Static Admin API tokens were deprecated in January 2026; apps now authenticate
// server-to-server with their Client ID + Secret and receive a short-lived token.
//
// Env:
//   SHOPIFY_STORE_DOMAIN  — e.g. "nauticalnomads.myshopify.com" (no protocol)
//   SHOPIFY_CLIENT_ID
//   SHOPIFY_CLIENT_SECRET
//   SHOPIFY_API_VERSION   — optional, defaults to "2026-01"

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-01";

let cached = { token: null, expiresAt: 0 };

function requireEnv() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const id = process.env.SHOPIFY_CLIENT_ID;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!domain || !id || !secret) {
    throw new Error(
      "Missing Shopify creds. Set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.",
    );
  }
  return { domain, id, secret };
}

// OAuth client credentials grant — exchanges client_id + client_secret for an
// access token. Cached in-process for ~50 minutes (Shopify tokens are ~1h).
export async function getAccessToken() {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;
  const { domain, id, secret } = requireEnv();

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Shopify auth failed (${res.status}): ${detail}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("Shopify auth: no access_token in response");

  cached = { token: data.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.access_token;
}

// GraphQL Admin API call (preferred — REST is being sunset).
export async function shopifyGraphQL(query, variables = {}) {
  const { domain } = requireEnv();
  const token = await getAccessToken();
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        descriptionHtml
        productType
        tags
        status
        vendor
        seo { title description }
        featuredImage { url altText }
        images(first: 20) { nodes { url altText } }
        provider:           metafield(namespace: "nn", key: "provider")            { value }
        provider_product_id: metafield(namespace: "nn", key: "provider_product_id") { value }
        variants(first: 100) {
          nodes {
            id
            sku
            title
            price
            compareAtPrice
            selectedOptions { name value }
            provider:            metafield(namespace: "nn", key: "provider")            { value }
            provider_variant_id: metafield(namespace: "nn", key: "provider_variant_id") { value }
          }
        }
      }
    }
  }
`;

// Async generator: yields each product, paginating internally.
export async function* iterateProducts() {
  let cursor = null;
  while (true) {
    const data = await shopifyGraphQL(PRODUCTS_QUERY, { cursor });
    const page = data.products;
    for (const node of page.nodes) yield node;
    if (!page.pageInfo.hasNextPage) return;
    cursor = page.pageInfo.endCursor;
  }
}
