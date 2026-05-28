/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Supabase Storage + POD CDNs (images come from migration, Session 03).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "files.cdn.printful.com" },
      { protocol: "https", hostname: "images-api.printify.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
};

export default nextConfig;

// Enables Cloudflare bindings (env, R2, etc.) during `next dev`.
// Safe no-op when the OpenNext Cloudflare context is unavailable.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
