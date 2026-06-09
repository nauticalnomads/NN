import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Canonical host. www.* and the legacy hyphenated domain 301→ the apex.
const CANONICAL_HOST = "nauticalnomads.com";
const REDIRECT_HOSTS = new Set([
  `www.${CANONICAL_HOST}`,
  "nautical-nomads.com",
  "www.nautical-nomads.com",
]);

// Runs site-wide for the canonical-host redirect; the Supabase auth refresh +
// section gating only runs for /admin, /login, /account, /auth (so we don't add
// an auth round-trip to every storefront page). Role-based access is enforced
// at the route/action layer (lib/auth.ts) + RLS.
export async function middleware(request: NextRequest) {
  const host = request.nextUrl.host.toLowerCase();
  if (REDIRECT_HOSTS.has(host)) {
    const target = request.nextUrl.clone();
    target.host = CANONICAL_HOST;
    target.protocol = "https";
    target.port = "";
    return NextResponse.redirect(target, 308);
  }

  const path = request.nextUrl.pathname;
  const needsAuth =
    path.startsWith("/admin") ||
    path === "/login" ||
    path.startsWith("/account") ||
    path.startsWith("/auth");
  if (!needsAuth) return NextResponse.next({ request });

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
  // Run everywhere except Next internals + files with an extension, so the
  // canonical-host redirect applies site-wide. Auth work inside is still scoped
  // to /admin, /login, /account, /auth.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
