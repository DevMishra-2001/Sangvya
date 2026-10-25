import { z } from "zod";
import { strongPassword } from "@/lib/password-policy";
import { email, requiredText } from "./common";

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  name: requiredText("Your name is required"),
  email,
  password: strongPassword,
});

export const forgotEmailSchema = z.object({ email });

export const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

// New password + confirmation (forgot password, change password)
export const newPasswordSchema = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "New password and confirm password don't match",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
