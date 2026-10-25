import { asyncHandler } from "../../utils/asyncHandler.js";
import { REFRESH_COOKIE } from "../../utils/authCookie.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser } from "../../utils/requestContext.js";
import { login, logout, me, refresh, signup } from "./auth.service.js";
import { requestOtp, resetPassword, verifyOtp } from "./passwordReset.service.js";

// POST /api/auth/signup
export const signupHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await signup(req, res, req.body));
});

// POST /api/auth/login
export const loginHandler = asyncHandler(async (req, res) => {
  res.json(await login(req, res, req.body));
});

// GET /api/auth/me
export const meHandler = asyncHandler(async (req, res) => {
  res.json(await me(currentUser(req).id));
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
