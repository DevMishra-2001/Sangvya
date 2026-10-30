// Activation links. The invited person opens the link, sets their own password
// and is logged in — nobody else ever knows it. Only a SHA-256 hash of the
// token is stored; issuing a new link revokes the earlier ones.
//
// In production the link is only emailed. Elsewhere it's also returned in the
// API response (devLink) so it can be tested without email.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { userInvitations, users } from "../../db/schema.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { sendTemplate } from "../mail/mail.service.js";
import { authPayload } from "../auth/auth.service.js";
import { startSession } from "../auth/session.service.js";
import { findUserById } from "../users/users.service.js";
import { audit } from "../../utils/audit.js";

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const appUrl = () => (env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
export const activationLink = (token: string) => `${appUrl()}/activate?token=${token}`;

// The link goes back in API responses only outside production (for testing)
export const devLink = (link: string) => (env.NODE_ENV === "production" ? undefined : link);

// New link for a login (revokes any earlier open ones). Returns the raw token —
// it's never stored, only its hash.
export async function createInvitation(userId: number, { companyName, invitedBy }: { companyName?: string | null; invitedBy: number | null }) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.INVITE_TTL_HOURS * 3600 * 1000);
  await db.transaction(async (tx) => {
    await tx
      .update(userInvitations)
      .set({ revoked_at: new Date() })
      .where(and(eq(userInvitations.user_id, userId), isNull(userInvitations.accepted_at), isNull(userInvitations.revoked_at)));
    await tx.insert(userInvitations).values({
      user_id: userId,
      purpose: "admin",
      company_name: companyName ?? null,
      token_hash: hash(token),
      expires_at: expiresAt,
      invited_by: invitedBy,
    });
  });
  return { token, expiresAt };
}

// The admin invitation email (printed to the console when SMTP isn't set up)
export function sendAdminInvitation(user: { name: string; email: string }, token: string, companyName: string | null | undefined, expiresAt: Date) {
  const link = activationLink(token);
  void sendTemplate(user.email, "adminInvitation", { name: user.name, companyName, link, expiresAt });
  return link;
}

// The latest invitation for this token, checked: not used, not revoked, not expired
async function validInvitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new BadRequestError("This activation link isn't valid", "INVITE_INVALID");
  const [row] = await db
    .select({ invite: userInvitations, user: { id: users.id, name: users.name, email: users.email, activated_at: users.activated_at } })
    .from(userInvitations)
    .innerJoin(users, eq(users.id, userInvitations.user_id))
    .where(eq(userInvitations.token_hash, hash(token)));
  if (!row || row.invite.revoked_at) throw new BadRequestError("This activation link isn't valid any more. Ask for a new one.", "INVITE_INVALID");
  if (row.invite.accepted_at || row.user.activated_at) throw new BadRequestError("This account is already activated — just log in.", "INVITE_USED");
  if (row.invite.expires_at <= new Date()) throw new BadRequestError("This activation link has expired. Ask for a new one.", "INVITE_EXPIRED");
  return row;
}

// POST /api/auth/invite/verify — what the activation page shows
export async function verifyInvitation(token: string) {
  const { invite, user } = await validInvitation(token);
  return { name: user.name, email: user.email, companyName: invite.company_name, expiresAt: invite.expires_at };
}

// POST /api/auth/invite/accept — set the password, activate, log in
export async function acceptInvitation(req: Request, res: Response, token: string, password: string) {
  const { invite, user } = await validInvitation(token);
  const passwordHash = await bcrypt.hash(password, 10);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ password_hash: passwordHash, activated_at: new Date() }).where(eq(users.id, user.id));
    await tx.update(userInvitations).set({ accepted_at: new Date() }).where(eq(userInvitations.id, invite.id));
  });
  const fresh = (await findUserById(user.id))!;
  audit(fresh, {
    action: "invite.accepted",
    target: ["user", fresh.id],
    summary: `${fresh.name} (${fresh.email}) activated their account`,
  });
  await startSession(res, req, fresh);
  return { ...(await authPayload(fresh)), companyName: invite.company_name };
}

// Latest invitation per login (for the Admins list)
export async function latestInvitation(userId: number) {
  const [row] = await db.select().from(userInvitations).where(eq(userInvitations.user_id, userId)).orderBy(desc(userInvitations.created_at)).limit(1);
  return row;
}
