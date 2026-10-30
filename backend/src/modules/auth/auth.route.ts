import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authLimiter, otpRequestLimiter, otpVerifyLimiter, resetPasswordLimiter } from "../../middlewares/rateLimiter.js";
import { validate } from "../../middlewares/validate.js";
import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  resetPasswordHandler,
  verifyOtpHandler,
} from "./auth.controller.js";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, verifyOtpSchema } from "./auth.schema.js";
import { acceptInviteHandler, verifyInviteHandler } from "../invitations/invitations.controller.js";
import { acceptInviteSchema, verifyInviteSchema } from "../invitations/invitations.schema.js";

const router = Router();

// No public signup: the Super Admin invites Admins (Admins page, /api/admins).
// The invited person activates their account from the emailed link:
router.post("/invite/verify", authLimiter, validate({ body: verifyInviteSchema }), verifyInviteHandler);
router.post("/invite/accept", authLimiter, validate({ body: acceptInviteSchema }), acceptInviteHandler);
router.post("/login", authLimiter, validate({ body: loginSchema }), loginHandler);
router.get("/me", authenticate, meHandler);
router.post("/refresh", refreshHandler);
router.post("/logout", logoutHandler);

// ---- Forgot password: email OTP → verify → new password (all rate limited) ----
router.post("/forgot-password", otpRequestLimiter, validate({ body: forgotPasswordSchema }), forgotPasswordHandler);
router.post("/verify-otp", otpVerifyLimiter, validate({ body: verifyOtpSchema }), verifyOtpHandler);
router.post("/reset-password", resetPasswordLimiter, validate({ body: resetPasswordSchema }), resetPasswordHandler);

export const authRoutes = router;
