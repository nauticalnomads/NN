import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

// `npm run build` runs this OpenNext build. OpenNext's Next.js build phase
// defaults to re-running `npm run build`, which would recurse forever — so point
// it directly at `next build`.
config.buildCommand = "npx next build";

export default config;
