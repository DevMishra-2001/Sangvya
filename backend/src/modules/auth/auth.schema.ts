import { z } from "zod";
import { strongPassword } from "../../utils/passwordPolicy.js";

const email = z.string({ required_error: "Valid email is required" }).trim().email("Valid email is required");


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

export type LoginInput = z.infer<typeof loginSchema>;
