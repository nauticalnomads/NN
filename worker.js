// Custom Cloudflare Worker entry. Wraps the OpenNext-generated handler (which
// provides `fetch`) and adds a `scheduled` handler so Cloudflare Cron Triggers
// (see wrangler.jsonc `triggers.crons`) can drive the hourly jobs.
//
// The scheduled handler replays internal authenticated POSTs to the existing
// /api/cron/* routes, so all the Next.js runtime context (env, Supabase client,
// Resend) is set up exactly as for a normal request.
//   - /api/cron/abandoned-cart — nudges still-pending carts.
//   - /api/cron/social         — publishes social drafts whose scheduled_at passed.
//   - /api/cron/blog           — publishes blog posts whose scheduled_at passed.
import openNextHandler from "./.open-next/worker.js";

const CRON_ROUTES = ["/api/cron/abandoned-cart", "/api/cron/social", "/api/cron/blog"];

export default {
  ...openNextHandler,
  async scheduled(event, env, ctx) {
    for (const path of CRON_ROUTES) {
      const req = new Request(`https://cron.internal${path}`, {
        method: "POST",
        headers: { "x-nn-cron-secret": env.CRON_SECRET ?? "" },
      });
      ctx.waitUntil(openNextHandler.fetch(req, env, ctx));
    }
  },
};
