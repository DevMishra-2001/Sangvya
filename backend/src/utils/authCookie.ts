// Login cookies. Both are HttpOnly: the browser sends them automatically,
// but no JavaScript (ours or an attacker's via XSS) can read them.
//   sangvya_token    short-lived access JWT
//   sangvya_refresh  refresh token
// Path is "/" so the Next.js frontend's proxy (which serves pages and forwards
// /api to this server) can read them on page requests to guard routes.
import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

export const ACCESS_COOKIE = "sangvya_token" as const;
export const REFRESH_COOKIE = "sangvya_refresh" as const;

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,                            // not readable from JS
    secure: env.NODE_ENV === "production",     // HTTPS-only in production
    // Strict: never sent on requests started by other sites (blocks CSRF).
    // If the frontend and API end up on different sites, set COOKIE_SAMESITE=none (requires HTTPS).
    sameSite: env.COOKIE_SAMESITE,
  };
}

interface AuthCookies {
  accessToken: string;
  refreshToken?: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}

// Cookie paths used before the move to "/" — still cleared so old cookies don't linger
const LEGACY_PATHS = { [ACCESS_COOKIE]: "/api", [REFRESH_COOKIE]: "/api/auth" };

export function setAuthCookies(res: Response, { accessToken, refreshToken, accessMaxAgeMs, refreshMaxAgeMs }: AuthCookies) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions(), path: "/", maxAge: accessMaxAgeMs });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), path: "/", maxAge: refreshMaxAgeMs });
  }
}

export function clearAuthCookies(res: Response) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    res.clearCookie(name, { ...baseOptions(), path: "/" });
    res.clearCookie(name, { ...baseOptions(), path: LEGACY_PATHS[name] });
  }
}
