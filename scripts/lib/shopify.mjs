// Shopify Admin API client.
//
// Two auth paths supported (the first one whose env is set wins):
//
//   1. SHOPIFY_ADMIN_TOKEN — a Custom App Admin API access token (e.g. atkn_…
//      or shpat_…). Used directly as the X-Shopify-Access-Token header. This
//      is the simplest path when the owner already has a token in hand.
//
//   2. SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET — OAuth client credentials
//      grant, exchanged at run time for a short-lived token. The recommended
//      path for apps without a stored access token.
//
// Env (always required):
//   SHOPIFY_STORE_DOMAIN   — e.g. "nautical-nomads-2.myshopify.com" (no protocol)
//   SHOPIFY_API_VERSION    — optional, defaults to "2026-01"

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-01";

let cached = { token: null, expiresAt: 0 };

function requireDomain() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error("Missing Shopify env: SHOPIFY_STORE_DOMAIN");
  return domain;
}

export async function getAccessToken() {
  // Path 1: direct access token — preferred when present, no network call.
  const direct = process.env.SHOPIFY_ADMIN_TOKEN;
  if (direct) return direct;

  // Path 2: OAuth client credentials grant (cached ~50 min).
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;
  const domain = requireDomain();
  const id = process.env.SHOPIFY_CLIENT_ID;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Missing Shopify auth. Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET.",
    );
  }

  const res = await fetchWithRetry(
    `https://${domain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: id,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
    },
    { label: "shopify oauth" },
  );
  if (!res.ok) {
    throw new Error(`Shopify auth failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("Shopify auth: no access_token in response");
  cached = { token: data.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.access_token;
}

import { fetchWithRetry } from "./retry.mjs";

// GraphQL Admin API call (preferred — REST is being sunset).
export async function shopifyGraphQL(query, variables = {}) {
  const domain = requireDomain();
  const token = await getAccessToken();
  const res = await fetchWithRetry(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    },
    { label: "shopify graphql" },
  );
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
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        descriptionHtml
        productType
        tags
        status
        vendor
        seo {
          title
          description
        }
        featuredImage {
          url
          altText
        }
        images(first: 20) {
          nodes {
            url
            altText
          }
        }
        provider: metafield(namespace: "nn", key: "provider") {
          value
        }
        provider_product_id: metafield(namespace: "nn", key: "provider_product_id") {
          value
        }
        variants(first: 100) {
          nodes {
            id
            sku
            title
            price
            compareAtPrice
            selectedOptions {
              name
              value
            }
            provider: metafield(namespace: "nn", key: "provider") {
              value
            }
            provider_variant_id: metafield(namespace: "nn", key: "provider_variant_id") {
              value
            }
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
