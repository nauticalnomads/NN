import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Refreshes the Supabase auth cookie on every request that hits /admin and
// gates the section: any unauthenticated request to /admin is redirected to
// /login. Role-based access (master vs regular vs content) is enforced at the
// route/action layer in app/admin (lib/auth.ts), backed by RLS in the DB.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase creds we can't auth — pass through; page guards still apply.
  if (!url || !anon) return response;

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    if (path.startsWith("/admin") && !user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", path);
      return NextResponse.redirect(redirectUrl);
    }

    if (path === "/login" && user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin";
      redirectUrl.searchParams.delete("next");
      return NextResponse.redirect(redirectUrl);
    }

    // Customer area: gate everything under /account except the login page.
    if (path.startsWith("/account") && path !== "/account/login" && !user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/account/login";
      redirectUrl.searchParams.set("next", path);
      return NextResponse.redirect(redirectUrl);
    }

    // Already signed in → skip the customer login page.
    if (path === "/account/login" && user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/account";
      redirectUrl.searchParams.delete("next");
      return NextResponse.redirect(redirectUrl);
    }
  } catch {
    // Reachability issue — let the request through; page guards still apply.
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/account/:path*", "/auth/:path*"],
};
