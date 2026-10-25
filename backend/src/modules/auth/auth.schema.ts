import { z } from "zod";
import { strongPassword } from "../../utils/passwordPolicy.js";
import { optionalText, requiredText } from "../../utils/zod.js";

const email = z.string({ required_error: "Valid email is required" }).trim().email("Valid email is required");

// "" counts as not given
const optionalName = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const signupSchema = z.object({
  // Optional: without it the company is created afterwards (POST /api/companies)
  companyName: optionalName(200),
  industry: optionalText(),
  designation: optionalName(100),
  name: requiredText("Your name is required"),
  email,
  password: strongPassword,
});

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email });

export const verifyOtpSchema = z.object({
  email,
  otp: z.string({ required_error: "OTP must be 6 digits" }).trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string({ required_error: "Reset token is required", invalid_type_error: "Reset token is required" }).length(64, "Invalid reset token"),
  newPassword: strongPassword,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
