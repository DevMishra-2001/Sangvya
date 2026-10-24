const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { authLimiter, otpRequestLimiter, otpVerifyLimiter, resetPasswordLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../utils/asyncHandler");
const { signup, login, me, refresh, logout } = require("../controllers/authController");
const passwordReset = require("../controllers/passwordResetController");
const { strongPassword } = require("../utils/passwordPolicy");

const router = express.Router();

router.post(
  "/signup",
  authLimiter,
  [
    body("companyName").trim().notEmpty().withMessage("Company name is required"),
    body("name").trim().notEmpty().withMessage("Your name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    strongPassword(body("password")),
  ],
  validate,
  asyncHandler(signup)
);

router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  asyncHandler(login)
);

router.get("/me", authenticate, asyncHandler(me));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));

// ---- Forgot password: email OTP → verify → new password (all rate limited) ----
router.post(
  "/forgot-password",
  otpRequestLimiter,
  [body("email").trim().isEmail().withMessage("Valid email is required")],
  validate,
  asyncHandler(passwordReset.requestOtp)
);

router.post(
  "/verify-otp",
  otpVerifyLimiter,
  [
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("otp").trim().matches(/^\d{6}$/).withMessage("OTP must be 6 digits"),
  ],
  validate,
  asyncHandler(passwordReset.verifyOtp)
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  [
    body("resetToken").isString().withMessage("Reset token is required").bail().isLength({ min: 64, max: 64 }).withMessage("Invalid reset token"),
    strongPassword(body("newPassword")),
  ],
  validate,
  asyncHandler(passwordReset.resetPassword)
);

module.exports = router;
