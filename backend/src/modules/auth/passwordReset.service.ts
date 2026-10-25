// Forgot password: email OTP → verify → set a new password.
// Brute force is limited twice: per IP+email by the rate limiters (routes),
// and per OTP here (max wrong attempts, expiry, resend cooldown).
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { passwordResets } from "../../db/schema.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { sendMail } from "../../utils/mailer.js";
import { findUserByEmailInsensitive, findUserWithPassword, setUserPassword } from "../users/users.service.js";
import { revokeAllSessionsForUser } from "./session.service.js";

const OTP_TTL_MIN = 5;           // OTP valid for 5 minutes
const OTP_MAX_ATTEMPTS = 5;      // wrong tries before the OTP is dead
const RESEND_COOLDOWN_SEC = 60;  // min gap between OTP emails for one user
const RESET_TTL_MIN = 15;        // after verifying, time left to set the password

// Same reply whether or not the email exists, so nobody can probe for accounts.
const GENERIC_SENT = "If an account exists for this email, an OTP has been sent to it.";
const TOO_MANY = "Too many wrong attempts. Please request a new OTP.";

const hmac = (value: string) => crypto.createHmac("sha256", env.JWT_SECRET).update(value).digest("hex");
const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function latestResetFor(userId: number) {
  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.user_id, userId))
    .orderBy(desc(passwordResets.created_at))
    .limit(1);
  return reset;
}

// POST /api/auth/forgot-password
export async function requestOtp(email: string) {
  const user = await findUserByEmailInsensitive(email);

  if (user) {
    const last = await latestResetFor(user.id);
    const tooSoon = last && !last.used_at && Date.now() - last.created_at.getTime() < RESEND_COOLDOWN_SEC * 1000;
    if (!tooSoon) {
      const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      // Replaces any earlier request for this user
      await db.transaction(async (tx) => {
        await tx.delete(passwordResets).where(eq(passwordResets.user_id, user.id));
        await tx.insert(passwordResets).values({
          user_id: user.id,
          otp_hash: hmac(otp),
          otp_expires_at: new Date(Date.now() + OTP_TTL_MIN * 60000),
        });
      });
      void sendMail({
        to: user.email,
        subject: "Your Sangvya password reset OTP",
        text: [
          `Hi ${user.name},`,
          "",
          `Your OTP to reset your Sangvya password is: ${otp}`,
          "",
          `It is valid for ${OTP_TTL_MIN} minutes. If you didn't ask for this, ignore this email — your password won't change.`,
        ].join("\n"),
      });
    }
  }
  return { message: GENERIC_SENT, resendAfterSec: RESEND_COOLDOWN_SEC, otpValidMin: OTP_TTL_MIN };
}

// POST /api/auth/verify-otp → { resetToken }
export async function verifyOtp(email: string, otp: string) {
  const invalid = new BadRequestError("OTP is invalid or has expired. Please request a new one.");

  const user = await findUserByEmailInsensitive(email);
  if (!user) throw invalid;
  const reset = await latestResetFor(user.id);
  if (!reset || reset.used_at || reset.verified_at || reset.otp_expires_at < new Date()) throw invalid;
  if (reset.attempts >= OTP_MAX_ATTEMPTS) throw new BadRequestError(TOO_MANY);

  if (!safeEqual(hmac(otp), reset.otp_hash)) {
    const [row] = await db
      .update(passwordResets)
      .set({ attempts: sql`${passwordResets.attempts} + 1` })
      .where(eq(passwordResets.id, reset.id))
      .returning({ attempts: passwordResets.attempts });
    const left = Math.max(0, OTP_MAX_ATTEMPTS - row.attempts);
    throw new BadRequestError(left ? `Incorrect OTP. ${left} attempt${left > 1 ? "s" : ""} left.` : TOO_MANY);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await db
    .update(passwordResets)
    .set({
      verified_at: sql`now()`,
      reset_token_hash: hmac(resetToken),
      reset_expires_at: new Date(Date.now() + RESET_TTL_MIN * 60000),
    })
    .where(eq(passwordResets.id, reset.id));
  return { resetToken, expiresInMin: RESET_TTL_MIN };
}

// POST /api/auth/reset-password
export async function resetPassword(resetToken: string, newPassword: string) {
  // A verified, unused, unexpired request matching the reset token
  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.reset_token_hash, hmac(resetToken)),
        isNull(passwordResets.used_at),
        gt(passwordResets.reset_expires_at, sql`now()`),
      ),
    );
  if (!reset) throw new BadRequestError("This reset link has expired. Please start again with a new OTP.");

  const user = await findUserWithPassword(reset.user_id);
  if (user && (await bcrypt.compare(newPassword, user.password_hash))) {
    throw new BadRequestError("New password must be different from the current one");
  }
  await setUserPassword(reset.user_id, await bcrypt.hash(newPassword, 10));
  // Whoever had access before the reset (e.g. an attacker) is logged out everywhere
  await revokeAllSessionsForUser(reset.user_id);
  await db.update(passwordResets).set({ used_at: sql`now()` }).where(eq(passwordResets.id, reset.id));
  return { message: "Password changed. Please log in with your new password." };
}
