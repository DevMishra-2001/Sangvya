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
  signupHandler,
  verifyOtpHandler,
} from "./auth.controller.js";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema, verifyOtpSchema } from "./auth.schema.js";

const router = Router();

router.post("/signup", authLimiter, validate({ body: signupSchema }), signupHandler);
router.post("/login", authLimiter, validate({ body: loginSchema }), loginHandler);
router.get("/me", authenticate, meHandler);
router.post("/refresh", refreshHandler);
router.post("/logout", logoutHandler);

// ---- Forgot password: email OTP → verify → new password (all rate limited) ----
router.post("/forgot-password", otpRequestLimiter, validate({ body: forgotPasswordSchema }), forgotPasswordHandler);
router.post("/verify-otp", otpVerifyLimiter, validate({ body: verifyOtpSchema }), verifyOtpHandler);
router.post("/reset-password", resetPasswordLimiter, validate({ body: resetPasswordSchema }), resetPasswordHandler);

export const authRoutes = router;
