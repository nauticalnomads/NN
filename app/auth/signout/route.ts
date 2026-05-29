import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Customers sign out to "/"; admins to "/login". Only allow same-site paths.
  const next = new URL(request.url).searchParams.get("next");
  const dest = next && next.startsWith("/") ? next : "/login";
  return NextResponse.redirect(new URL(dest, request.url));
}
