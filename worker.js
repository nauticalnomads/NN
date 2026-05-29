// Custom Cloudflare Worker entry. Wraps the OpenNext-generated handler (which
// provides `fetch`) and adds a `scheduled` handler so Cloudflare Cron Triggers
// (see wrangler.jsonc `triggers.crons`) can drive the abandoned-cart journey.
//
// The scheduled handler simply replays an internal authenticated POST to the
// existing /api/cron/abandoned-cart route, so all the Next.js runtime context
// (env, Supabase client, Resend) is set up exactly as for a normal request.
import openNextHandler from "./.open-next/worker.js";

export default {
  ...openNextHandler,
  async scheduled(event, env, ctx) {
    const req = new Request("https://cron.internal/api/cron/abandoned-cart", {
      method: "POST",
      headers: { "x-nn-cron-secret": env.CRON_SECRET ?? "" },
    });
    ctx.waitUntil(openNextHandler.fetch(req, env, ctx));
  },
};
