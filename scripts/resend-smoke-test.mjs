#!/usr/bin/env node
/**
 * Resend smoke test (Session 01 done-criterion).
 *
 * Verifies the sending domain works end-to-end by sending ONE plain email.
 * This does NOT configure DNS — the owner must add SPF/DKIM/DMARC records in
 * Cloudflare DNS and verify the domain in the Resend dashboard first. See
 * PROGRESS.md for the manual steps.
 *
 * Usage:
 *   RESEND_API_KEY=re_... RESEND_FROM=hello@nauticalnomads.com \
 *   RESEND_SMOKE_TEST_TO=you@example.com node scripts/resend-smoke-test.mjs
 */
import { Resend } from "resend";

const { RESEND_API_KEY, RESEND_FROM, RESEND_SMOKE_TEST_TO } = process.env;

if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_SMOKE_TEST_TO) {
  console.error(
    "Missing env. Required: RESEND_API_KEY, RESEND_FROM, RESEND_SMOKE_TEST_TO.\n" +
      "See .env.example.",
  );
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: RESEND_FROM,
  to: RESEND_SMOKE_TEST_TO,
  subject: "Nautical Nomads — Resend smoke test",
  text:
    "Fog on the harbor. If this landed in your inbox (not spam), the sending " +
    "domain is verified and transactional email is good to go.\n\nLive by the tide.",
});

if (error) {
  console.error("Send failed:", error);
  process.exit(1);
}

console.log("Sent. Resend id:", data?.id);
console.log("Check the inbox (and spam folder) for", RESEND_SMOKE_TEST_TO);
