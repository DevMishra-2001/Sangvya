import { asyncHandler } from "../../utils/asyncHandler.js";
import { REFRESH_COOKIE } from "../../utils/authCookie.js";
import { currentUser } from "../../utils/requestContext.js";
import { login, logout, meWithFreshToken, refresh } from "./auth.service.js";
import { requestOtp, resetPassword, verifyOtp } from "./passwordReset.service.js";

// POST /api/auth/login
export const loginHandler = asyncHandler(async (req, res) => {
  res.json(await login(req, res, req.body));
});

// GET /api/auth/me
export const meHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  res.json(await meWithFreshToken(res, user.id, user.sessionId));
});

// POST /api/auth/refresh
export const refreshHandler = asyncHandler(async (req, res) => {
  res.json(await refresh(res, req.cookies?.[REFRESH_COOKIE]));
});

// POST /api/auth/logout
export const logoutHandler = asyncHandler(async (req, res) => {
  res.json(await logout(res, req.cookies?.[REFRESH_COOKIE]));
});

// POST /api/auth/forgot-password  { email }
export const forgotPasswordHandler = asyncHandler(async (req, res) => {
  res.json(await requestOtp(req.body.email));
});

// POST /api/auth/verify-otp  { email, otp }
export const verifyOtpHandler = asyncHandler(async (req, res) => {
  res.json(await verifyOtp(req.body.email, req.body.otp));
});

// POST /api/auth/reset-password  { resetToken, newPassword }
export const resetPasswordHandler = asyncHandler(async (req, res) => {
  res.json(await resetPassword(req.body.resetToken, req.body.newPassword));
});
