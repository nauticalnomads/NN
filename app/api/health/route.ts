import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Trivial server-side Supabase ping (Session 01 done-criterion).
// Issues a cheap auth call that succeeds against any valid project — it does
// not require any tables to exist yet (schema lands in Session 02).
export async function GET() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!configured) {
    return NextResponse.json(
      { ok: false, supabase: "unconfigured", hint: "Set NEXT_PUBLIC_SUPABASE_* env vars." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    // Cheap, anon-readable query that also confirms the schema is migrated.
    const { error } = await supabase.from("products").select("id", { head: true, count: "exact" });
    if (error) throw error;
    return NextResponse.json({ ok: true, supabase: "reachable", schema: "migrated" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, supabase: "error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
