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
//   - /api/cron/cleanup-pending — cancels abandoned pending orders + frees their
//     credit/gift-card reservations.
import openNextHandler from "./.open-next/worker.js";

const CRON_ROUTES = [
  "/api/cron/abandoned-cart",
  "/api/cron/social",
  "/api/cron/blog",
  "/api/cron/cleanup-pending",
];

export default {
  ...openNextHandler,
  async scheduled(event, env, ctx) {
    // The cron routes fail closed on a missing secret anyway, but skip the
    // dispatch entirely (and say why) so a misconfigured deploy is obvious.
    if (!env.CRON_SECRET) {
      console.error("CRON_SECRET not set — skipping scheduled jobs");
      return;
    }
    for (const path of CRON_ROUTES) {
      // Isolate each job: one route throwing on dispatch must not stop the rest.
      try {
        const req = new Request(`https://cron.internal${path}`, {
          method: "POST",
          headers: { "x-nn-cron-secret": env.CRON_SECRET },
        });
        ctx.waitUntil(openNextHandler.fetch(req, env, ctx));
      } catch (e) {
        console.error(`cron dispatch failed for ${path}:`, e);
      }
    }
  },
};
