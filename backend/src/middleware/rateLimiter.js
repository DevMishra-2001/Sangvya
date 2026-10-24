const rateLimit = require("express-rate-limit");

const WINDOW_15_MIN = 15 * 60 * 1000;

// General API limiter — generous, just to blunt abuse/scraping.
const apiLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Tighter limiter for auth routes — slows down brute-force login/signup attempts.
const authLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again in a few minutes" },
});

// ---- Forgot password ----
// Keyed by IP + email, so one attacker can't flood a victim's inbox or brute
// force their OTP, and one shared office IP doesn't block everyone else.
const byIpAndEmail = (req) => `${req.ip}|${String(req.body?.email || "").trim().toLowerCase()}`;

// Sending OTP emails: 3 per 15 min per IP+email
const otpRequestLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 3,
  keyGenerator: byIpAndEmail,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP requests. Please try again after 15 minutes." },
});

// Checking OTPs: 10 per 15 min per IP+email (each OTP also dies after 5 wrong tries)
const otpVerifyLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 10,
  keyGenerator: byIpAndEmail,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP attempts. Please try again after 15 minutes." },
});

// Setting the new password: 10 per 15 min per IP
const resetPasswordLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again in a few minutes" },
});

module.exports = { apiLimiter, authLimiter, otpRequestLimiter, otpVerifyLimiter, resetPasswordLimiter };
