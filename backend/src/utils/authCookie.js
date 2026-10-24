// Login cookies. Both are HttpOnly: the browser sends them automatically,
// but no JavaScript (ours or an attacker's via XSS) can read them.
//   sangvya_token    short-lived access JWT, sent with every /api request
//   sangvya_refresh  refresh token, only sent to /api/auth (refresh + logout)
const ACCESS_COOKIE = "sangvya_token";
const REFRESH_COOKIE = "sangvya_refresh";

function baseOptions() {
  return {
    httpOnly: true,                                   // not readable from JS
    secure: process.env.NODE_ENV === "production",    // HTTPS-only in production
    // Strict: never sent on requests started by other sites (blocks CSRF).
    // If the frontend and API end up on different sites, set COOKIE_SAMESITE=none (requires HTTPS).
    sameSite: process.env.COOKIE_SAMESITE || "strict",
  };
}

function setAuthCookies(res, { accessToken, refreshToken, accessMaxAgeMs, refreshMaxAgeMs }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions(), path: "/api", maxAge: accessMaxAgeMs });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), path: "/api/auth", maxAge: refreshMaxAgeMs });
  }
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: "/api" });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: "/api/auth" });
}

module.exports = { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies, clearAuthCookies };
