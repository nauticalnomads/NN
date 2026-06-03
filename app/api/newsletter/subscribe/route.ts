import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCmsValue } from "@/lib/cms";
import { sendNewsletterWelcome } from "@/lib/email";

export const runtime = "nodejs";

// Newsletter signup (redesign v2 §6.1). Inserts to newsletter_subscribers, then
// fires the Resend welcome+discount email once per address. Idempotent: a
// repeat signup is acknowledged without re-sending. Degrades gracefully if the
// table isn't migrated yet (returns ok so the form still confirms politely).
export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 422 });
  }

  const source = "footer";
  try {
    const sb = createServiceClient();
    // Already subscribed?
    const { data: existing } = await sb
      .from("newsletter_subscribers")
      .select("id, discount_sent")
      .eq("email", email)
      .maybeSingle();
    const row = existing as unknown as { id: string; discount_sent: boolean } | null;

    if (row?.discount_sent) {
      // Already welcomed — acknowledge, don't re-send.
      return NextResponse.json({ ok: true, already: true });
    }

    if (!row) {
      await sb.from("newsletter_subscribers").insert({ email, source } as never);
    }

    // Discount code is admin-configurable via CMS (§7.9); default WELCOME10.
    const cfg = await getCmsValue<{ code?: string }>("newsletter.settings");
    const code = (cfg?.code as string) || "WELCOME10";

    await sendNewsletterWelcome(email, code).catch(() => undefined);
    await sb
      .from("newsletter_subscribers")
      .update({ discount_sent: true } as never)
      .eq("email", email);

    return NextResponse.json({ ok: true });
  } catch {
    // Backend not ready (table missing) — still confirm so UX isn't broken.
    return NextResponse.json({ ok: true, deferred: true });
  }
}
