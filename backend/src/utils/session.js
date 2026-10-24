// Login sessions: a 5-minute access token + a rotating refresh token.
//
//  • Access JWT (cookie sangvya_token): short-lived, carries { id, companyId, sid }.
//  • Refresh token (cookie sangvya_refresh): random, only its hash is stored. Each
//    refresh swaps it for a new one (rotation). Re-using an old one after the
//    short grace window = likely theft → the whole session is revoked.
//  • Idle limit: a refresh is refused if the session had no activity for
//    SESSION_IDLE_MIN minutes (the browser only refreshes while the user is active).
//  • Absolute limit: SESSION_MAX_HOURS after login, however active.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const SessionModel = require("../models/sessionModel");
const { setAuthCookies } = require("./authCookie");

const ACCESS_TTL_MIN = Number(process.env.ACCESS_TOKEN_TTL_MIN || 5);
const IDLE_MIN = Number(process.env.SESSION_IDLE_MIN || 20);
const MAX_HOURS = Number(process.env.SESSION_MAX_HOURS || 12);
const ROTATION_GRACE_SEC = 30; // parallel tabs may send the just-replaced token

const hashToken = (t) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(t).digest("hex");
const newRefreshToken = () => crypto.randomBytes(48).toString("hex");

function signAccessToken(user, sessionId) {
  return jwt.sign({ id: user.id, companyId: user.company_id, sid: sessionId }, process.env.JWT_SECRET, {
    expiresIn: `${ACCESS_TTL_MIN}m`,
  });
}

function refreshMaxAgeMs(session) {
  return Math.max(0, new Date(session.expires_at) - Date.now());
}

// Login / signup: create the session and set both cookies.
async function startSession(res, req, user) {
  const refreshToken = newRefreshToken();
  const session = await SessionModel.create({
    userId: user.id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + MAX_HOURS * 3600 * 1000),
    userAgent: (req.headers["user-agent"] || "").slice(0, 300),
    ip: req.ip,
  });
  setAuthCookies(res, {
    accessToken: signAccessToken(user, session.id),
    refreshToken,
    accessMaxAgeMs: ACCESS_TTL_MIN * 60000,
    refreshMaxAgeMs: refreshMaxAgeMs(session),
  });
  return session;
}

// POST /auth/refresh. Returns { ok: true } or { ok: false, code, error }.
async function refreshSession(res, refreshToken, loadUser) {
  if (!refreshToken) return { ok: false, code: "NO_SESSION", error: "Not logged in" };
  const hash = hashToken(refreshToken);

  let session = await SessionModel.findByTokenHash(hash);
  if (!session) {
    const previous = await SessionModel.findByPreviousHash(hash);
    if (previous && !previous.revoked_at) {
      const age = (Date.now() - new Date(previous.rotated_at)) / 1000;
      // Another tab refreshed a moment ago — the browser already has the new cookies
      if (age <= ROTATION_GRACE_SEC) return { ok: true, alreadyRefreshed: true };
      // An old token replayed long after rotation: treat as stolen
      await SessionModel.revoke(previous.id);
      return { ok: false, code: "SESSION_REVOKED", error: "Your session was ended for security reasons. Please log in again." };
    }
    return { ok: false, code: "NO_SESSION", error: "Session not found. Please log in again." };
  }

  if (session.revoked_at) return { ok: false, code: "SESSION_REVOKED", error: "Your session has ended. Please log in again." };
  if (new Date(session.expires_at) <= new Date()) {
    await SessionModel.revoke(session.id);
    return { ok: false, code: "SESSION_EXPIRED", error: "Your session has expired. Please log in again." };
  }
  if (Date.now() - new Date(session.last_activity_at) > IDLE_MIN * 60000) {
    await SessionModel.revoke(session.id);
    return { ok: false, code: "SESSION_IDLE", error: `You were logged out after ${IDLE_MIN} minutes of inactivity.` };
  }

  const user = await loadUser(session.user_id);
  if (!user) {
    await SessionModel.revoke(session.id);
    return { ok: false, code: "NO_SESSION", error: "Account no longer exists" };
  }

  const nextToken = newRefreshToken();
  await SessionModel.rotate(session.id, hashToken(nextToken));
  setAuthCookies(res, {
    accessToken: signAccessToken(user, session.id),
    refreshToken: nextToken,
    accessMaxAgeMs: ACCESS_TTL_MIN * 60000,
    refreshMaxAgeMs: refreshMaxAgeMs(session),
  });
  return { ok: true };
}

// Logout: revoke the session behind this refresh token (if any).
async function endSession(refreshToken) {
  if (!refreshToken) return;
  const hash = hashToken(refreshToken);
  const session = (await SessionModel.findByTokenHash(hash)) || (await SessionModel.findByPreviousHash(hash));
  if (session) await SessionModel.revoke(session.id);
}

module.exports = { startSession, refreshSession, endSession, ACCESS_TTL_MIN, IDLE_MIN, MAX_HOURS };
