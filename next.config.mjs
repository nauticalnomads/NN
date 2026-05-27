/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // POD CDNs + Supabase Storage will be added as products are migrated (Session 03).
    remotePatterns: [],
  },
};

export default nextConfig;

// Enables Cloudflare bindings (env, R2, etc.) during `next dev`.
// Safe no-op when the OpenNext Cloudflare context is unavailable.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
