import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth / magic-link callback — exchanges the code for a session and redirects
// back to the originally-requested admin path (defaults to /admin).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/admin";
  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url),
      );
    }
  }
  return NextResponse.redirect(new URL(next, url));
}
