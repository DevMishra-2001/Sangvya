// Forgot password: email OTP → verify → set a new password.
// Brute force is limited twice: per IP+email by express-rate-limit (routes),
// and per OTP here (max wrong attempts, expiry, resend cooldown).
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const UserModel = require("../models/userModel");
const PasswordResetModel = require("../models/passwordResetModel");
const SessionModel = require("../models/sessionModel");
const { sendMail } = require("../utils/mailer");

const OTP_TTL_MIN = 5;           // OTP valid for 5 minutes
const OTP_MAX_ATTEMPTS = 5;      // wrong tries before the OTP is dead
const RESEND_COOLDOWN_SEC = 60;  // min gap between OTP emails for one user
const RESET_TTL_MIN = 15;        // after verifying, time left to set the password

// Same reply whether or not the email exists, so nobody can probe for accounts.
const GENERIC_SENT = "If an account exists for this email, an OTP has been sent to it.";

const hmac = (value) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(String(value)).digest("hex");
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// POST /api/auth/forgot-password  { email }
async function requestOtp(req, res) {
  const email = String(req.body.email).trim();
  const user = await UserModel.findByEmailInsensitive(email);

  if (user) {
    const last = await PasswordResetModel.latestForUser(user.id);
    const tooSoon = last && !last.used_at && Date.now() - new Date(last.created_at) < RESEND_COOLDOWN_SEC * 1000;
    if (!tooSoon) {
      const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      await PasswordResetModel.create(user.id, hmac(otp), new Date(Date.now() + OTP_TTL_MIN * 60000));
      sendMail({
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
  res.json({ message: GENERIC_SENT, resendAfterSec: RESEND_COOLDOWN_SEC, otpValidMin: OTP_TTL_MIN });
}

// POST /api/auth/verify-otp  { email, otp }  → { resetToken }
async function verifyOtp(req, res) {
  const email = String(req.body.email).trim();
  const otp = String(req.body.otp).trim();
  const invalid = () => res.status(400).json({ error: "OTP is invalid or has expired. Please request a new one." });

  const user = await UserModel.findByEmailInsensitive(email);
  if (!user) return invalid();
  const reset = await PasswordResetModel.latestForUser(user.id);
  if (!reset || reset.used_at || reset.verified_at || new Date(reset.otp_expires_at) < new Date()) return invalid();
  if (reset.attempts >= OTP_MAX_ATTEMPTS) {
    return res.status(400).json({ error: "Too many wrong attempts. Please request a new OTP." });
  }

  if (!safeEqual(hmac(otp), reset.otp_hash)) {
    const attempts = await PasswordResetModel.incrementAttempts(reset.id);
    const left = Math.max(0, OTP_MAX_ATTEMPTS - attempts);
    return res.status(400).json({
      error: left ? `Incorrect OTP. ${left} attempt${left > 1 ? "s" : ""} left.` : "Too many wrong attempts. Please request a new OTP.",
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await PasswordResetModel.markVerified(reset.id, hmac(resetToken), new Date(Date.now() + RESET_TTL_MIN * 60000));
  res.json({ resetToken, expiresInMin: RESET_TTL_MIN });
}

// POST /api/auth/reset-password  { resetToken, newPassword }
async function resetPassword(req, res) {
  const { resetToken, newPassword } = req.body;
  const reset = await PasswordResetModel.findValidByToken(hmac(resetToken));
  if (!reset) {
    return res.status(400).json({ error: "This reset link has expired. Please start again with a new OTP." });
  }
  const user = await UserModel.findWithPasswordById(reset.user_id);
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    return res.status(400).json({ error: "New password must be different from the current one" });
  }
  await UserModel.updatePassword(reset.user_id, await bcrypt.hash(newPassword, 10));
  // Whoever had access before the reset (e.g. an attacker) is logged out everywhere
  await SessionModel.revokeAllForUser(reset.user_id);
  await PasswordResetModel.markUsed(reset.id);
  res.json({ message: "Password changed. Please log in with your new password." });
}

module.exports = { requestOtp, verifyOtp, resetPassword };
