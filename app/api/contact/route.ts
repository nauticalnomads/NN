import { NextResponse, type NextRequest } from "next/server";
import { sendOwnerAlert } from "@/lib/email";

export const runtime = "nodejs";

// Contact form (§9 help page). Emails the owner via the existing Resend alert
// channel. No DB row needed — it's a notification, not a record. Degrades
// gracefully if Resend/owner email isn't configured (still returns ok).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").slice(0, 120);
  const email = String(body?.email || "").slice(0, 200);
  const message = String(body?.message || "").slice(0, 4000);
  if (!email || !message) {
    return NextResponse.json({ error: "Email and message are required." }, { status: 422 });
  }
  await sendOwnerAlert(
    `Contact form — ${name || email}`,
    `From: ${name} <${email}>\n\n${message}`,
  ).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
