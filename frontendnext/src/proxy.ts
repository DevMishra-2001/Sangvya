// Runs before every page request. Decides, from the login cookies alone:
//   • logged out on a protected page        → /login?next=<page>
//   • logged in on /login, /forgot-password → /
//   • logged in but their designation can't open it → /forbidden
//   • superadmin without a company yet        → /onboarding (and only there)
// Allowed pages come from the backend's signed access token (Page Master URLs). If that token has
// expired but the refresh cookie is still good, the session is refreshed here
// (the backend rotates the cookies and we pass them on to the browser).
// This only guards pages — the backend checks permissions on every API call.
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieValueFromSetCookie, verifyAccessToken } from "@/lib/auth/token";
import { ONBOARDING_ROUTE, canVisit, isPublicRoute } from "@/lib/permissions";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:5000";

// Swap the refresh cookie for a new pair. Returns the backend's Set-Cookie
// headers (new cookies on success, cleared cookies on failure).
async function refreshSession(request: NextRequest) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
      },
      cache: "no-store",
    });
    return { ok: res.ok, setCookies: res.headers.getSetCookie() };
  } catch {
    return { ok: false, setCookies: [] }; // backend unreachable — treat as logged out
  }
}

function withCookies(response: NextResponse, setCookies: string[]) {
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let payload = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value);
  let loggedIn = Boolean(payload);
  let setCookies: string[] = [];

  if (!payload && request.cookies.has(REFRESH_COOKIE)) {
    const refreshed = await refreshSession(request);
    setCookies = refreshed.setCookies;
    if (refreshed.ok) {
      // A parallel request (e.g. a link prefetch) may have rotated the token a
      // moment ago: the backend then accepts the old one but sends no new
      // cookies. The session is still valid — access is checked again by the
      // app shell once the browser has the new cookie.
      loggedIn = true;
      payload = await verifyAccessToken(cookieValueFromSetCookie(setCookies, ACCESS_COOKIE));
    }
  }

  if (isPublicRoute(pathname)) {
    if (loggedIn) return withCookies(NextResponse.redirect(new URL("/", request.url)), setCookies);
    return withCookies(NextResponse.next(), setCookies);
  }

  if (!loggedIn) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return withCookies(NextResponse.redirect(login), setCookies);
  }

  // A new Admin registers their company before anything else; afterwards that
  // page is done (more companies are added from /companies/new). A Super Admin
  // without a company may use the platform pages their token lists (Admins, Page Master).
  const onOnboarding = pathname === ONBOARDING_ROUTE;
  if (payload && !payload.companyId && !onOnboarding) {
    const platformPages = payload.pages ?? [];
    if (!platformPages.length) return withCookies(NextResponse.redirect(new URL(ONBOARDING_ROUTE, request.url)), setCookies);
    if (pathname === "/" || !canVisit(platformPages, pathname)) {
      return withCookies(NextResponse.redirect(new URL(platformPages[0], request.url)), setCookies);
    }
  }
  if (payload?.companyId && onOnboarding) {
    return withCookies(NextResponse.redirect(new URL("/", request.url)), setCookies);
  }

  if (payload && !canVisit(payload.pages, pathname)) {
    const forbidden = new URL("/forbidden", request.url);
    forbidden.searchParams.set("from", pathname);
    return withCookies(NextResponse.redirect(forbidden), setCookies);
  }

  return withCookies(NextResponse.next(), setCookies);
}

export const config = {
  // Pages only: skip the API (forwarded to the backend), Next internals and files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
