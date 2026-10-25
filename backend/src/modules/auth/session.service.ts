// Login sessions: a short access token + a rotating refresh token.
//
//  • Access JWT (cookie sangvya_token): short-lived, carries { id, companyId, sid, role }.
//  • Refresh token (cookie sangvya_refresh): random, only its hash is stored. Each
//    refresh swaps it for a new one (rotation). Re-using an old one after the
//    short grace window = likely theft → the whole session is revoked.
//  • Idle limit: a refresh is refused if the session had no activity for
//    SESSION_IDLE_MIN minutes (the browser only refreshes while the user is active).
//  • Absolute limit: SESSION_MAX_HOURS after login, however active.
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { userSessions } from "../../db/schema.js";
import { setAuthCookies } from "../../utils/authCookie.js";

export const ACCESS_TTL_MIN = env.ACCESS_TOKEN_TTL_MIN;
export const IDLE_MIN = env.SESSION_IDLE_MIN;
export const MAX_HOURS = env.SESSION_MAX_HOURS;
const ROTATION_GRACE_SEC = 30; // parallel tabs may send the just-replaced token

// Session timings the browser needs for its keep-alive / idle-logout timers
export const SESSION_INFO = { accessTtlMin: ACCESS_TTL_MIN, idleMin: IDLE_MIN };

type Session = typeof userSessions.$inferSelect;

interface SessionUser {
  id: number;
  company_id: number | null;
  role: string;
}

export type RefreshResult =
  | { ok: true; alreadyRefreshed?: boolean }
  | { ok: false; code: "NO_SESSION" | "SESSION_REVOKED" | "SESSION_EXPIRED" | "SESSION_IDLE"; error: string };

const hashToken = (t: string) => crypto.createHmac("sha256", env.JWT_SECRET).update(t).digest("hex");
const newRefreshToken = () => crypto.randomBytes(48).toString("hex");

// `role` lets the Next.js frontend's proxy guard pages without an API call.
// It is only a UI hint — every API request re-reads the user and checks permissions.
function signAccessToken(user: SessionUser, sessionId: number) {
  return jwt.sign({ id: user.id, companyId: user.company_id, sid: sessionId, role: user.role }, env.JWT_SECRET, {
    expiresIn: `${ACCESS_TTL_MIN}m`,
  });
}

const refreshMaxAgeMs = (session: Session) => Math.max(0, session.expires_at.getTime() - Date.now());

// ---- Data access ----

export async function findSessionById(id: number) {
  const [session] = await db.select().from(userSessions).where(eq(userSessions.id, id));
  return session;
}

async function findByTokenHash(hash: string) {
  const [session] = await db.select().from(userSessions).where(eq(userSessions.refresh_token_hash, hash));
  return session;
}

// The session whose PREVIOUS refresh token matches (it was just rotated, or stolen)
async function findByPreviousHash(hash: string) {
  const [session] = await db.select().from(userSessions).where(eq(userSessions.previous_token_hash, hash));
  return session;
}

async function revokeSession(id: number) {
  await db
    .update(userSessions)
    .set({ revoked_at: sql`now()` })
    .where(and(eq(userSessions.id, id), isNull(userSessions.revoked_at)));
}

// Ends every session of a user (optionally keeping one, e.g. the current device)
export async function revokeAllSessionsForUser(userId: number, exceptSessionId: number | null = null) {
  await db
    .update(userSessions)
    .set({ revoked_at: sql`now()` })
    .where(
      and(
        eq(userSessions.user_id, userId),
        isNull(userSessions.revoked_at),
        exceptSessionId ? ne(userSessions.id, exceptSessionId) : undefined,
      ),
    );
}

// ---- Flows ----

// Login / signup: create the session and set both cookies.
export async function startSession(res: Response, req: Request, user: SessionUser) {
  const refreshToken = newRefreshToken();
  const [session] = await db
    .insert(userSessions)
    .values({
      user_id: user.id,
      refresh_token_hash: hashToken(refreshToken),
      expires_at: new Date(Date.now() + MAX_HOURS * 3600 * 1000),
      user_agent: (req.headers["user-agent"] || "").slice(0, 300),
      ip: req.ip,
    })
    .returning();

  setAuthCookies(res, {
    accessToken: signAccessToken(user, session.id),
    refreshToken,
    accessMaxAgeMs: ACCESS_TTL_MIN * 60000,
    refreshMaxAgeMs: refreshMaxAgeMs(session),
  });
  return session;
}

// After the user's company or role changes (company created / switched): a new
// access token for the same session, so the frontend's page guard sees it at once.
export function reissueAccessToken(res: Response, user: SessionUser, sessionId: number) {
  setAuthCookies(res, { accessToken: signAccessToken(user, sessionId), accessMaxAgeMs: ACCESS_TTL_MIN * 60000, refreshMaxAgeMs: 0 });
}

// POST /auth/refresh — swap the refresh token for a new pair of cookies.
export async function refreshSession(
  res: Response,
  refreshToken: string | undefined,
  loadUser: (id: number) => Promise<SessionUser | undefined>,
): Promise<RefreshResult> {
  if (!refreshToken) return { ok: false, code: "NO_SESSION", error: "Not logged in" };
  const hash = hashToken(refreshToken);

  const session = await findByTokenHash(hash);
  if (!session) {
    const previous = await findByPreviousHash(hash);
    if (previous && !previous.revoked_at) {
      const ageSec = previous.rotated_at ? (Date.now() - previous.rotated_at.getTime()) / 1000 : Infinity;
      // Another tab refreshed a moment ago — the browser already has the new cookies
      if (ageSec <= ROTATION_GRACE_SEC) return { ok: true, alreadyRefreshed: true };
      // An old token replayed long after rotation: treat as stolen
      await revokeSession(previous.id);
      return { ok: false, code: "SESSION_REVOKED", error: "Your session was ended for security reasons. Please log in again." };
    }
    return { ok: false, code: "NO_SESSION", error: "Session not found. Please log in again." };
  }

  if (session.revoked_at) return { ok: false, code: "SESSION_REVOKED", error: "Your session has ended. Please log in again." };
  if (session.expires_at <= new Date()) {
    await revokeSession(session.id);
    return { ok: false, code: "SESSION_EXPIRED", error: "Your session has expired. Please log in again." };
  }
  if (Date.now() - session.last_activity_at.getTime() > IDLE_MIN * 60000) {
    await revokeSession(session.id);
    return { ok: false, code: "SESSION_IDLE", error: `You were logged out after ${IDLE_MIN} minutes of inactivity.` };
  }

  const user = await loadUser(session.user_id);
  if (!user) {
    await revokeSession(session.id);
    return { ok: false, code: "NO_SESSION", error: "Account no longer exists" };
  }

  // New refresh token in, old one kept briefly as "previous"; marks the user active
  const nextToken = newRefreshToken();
  await db
    .update(userSessions)
    .set({
      previous_token_hash: sql`${userSessions.refresh_token_hash}`,
      refresh_token_hash: hashToken(nextToken),
      rotated_at: sql`now()`,
      last_activity_at: sql`now()`,
    })
    .where(eq(userSessions.id, session.id));

  setAuthCookies(res, {
    accessToken: signAccessToken(user, session.id),
    refreshToken: nextToken,
    accessMaxAgeMs: ACCESS_TTL_MIN * 60000,
    refreshMaxAgeMs: refreshMaxAgeMs(session),
  });
  return { ok: true };
}

// Logout: revoke the session behind this refresh token (if any).
export async function endSession(refreshToken: string | undefined) {
  if (!refreshToken) return;
  const hash = hashToken(refreshToken);
  const session = (await findByTokenHash(hash)) || (await findByPreviousHash(hash));
  if (session) await revokeSession(session.id);
}
