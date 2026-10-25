import type { Request } from "express";
import rateLimit from "express-rate-limit";

const WINDOW_15_MIN = 15 * 60 * 1000;

const limiter = (max: number, error: string, keyGenerator?: (req: Request) => string) =>
  rateLimit({
    windowMs: WINDOW_15_MIN,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error },
    ...(keyGenerator ? { keyGenerator } : {}),
  });

// General API limiter — generous, just to blunt abuse/scraping.
export const apiLimiter = limiter(300, "Too many requests, please try again later");

// Tighter limiter for auth routes — slows down brute-force login/signup attempts.
export const authLimiter = limiter(20, "Too many attempts, please try again in a few minutes");

// ---- Forgot password ----
// Keyed by IP + email, so one attacker can't flood a victim's inbox or brute
// force their OTP, and one shared office IP doesn't block everyone else.
const byIpAndEmail = (req: Request) => `${req.ip}|${String(req.body?.email || "").trim().toLowerCase()}`;

// Sending OTP emails: 3 per 15 min per IP+email
export const otpRequestLimiter = limiter(3, "Too many OTP requests. Please try again after 15 minutes.", byIpAndEmail);

// Checking OTPs: 10 per 15 min per IP+email (each OTP also dies after 5 wrong tries)
export const otpVerifyLimiter = limiter(10, "Too many OTP attempts. Please try again after 15 minutes.", byIpAndEmail);

// Setting the new password: 10 per 15 min per IP
export const resetPasswordLimiter = limiter(10, "Too many attempts, please try again in a few minutes");
