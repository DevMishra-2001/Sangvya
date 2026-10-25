// Mirror of backend/src/utils/passwordPolicy.ts — live hints and early errors.
// The backend enforces the same rules.
import { z } from "zod";

export const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", message: "Password must be at least 8 characters long", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter (A–Z)", message: "Password must contain at least one uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter (a–z)", message: "Password must contain at least one lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "One number (0–9)", message: "Password must contain at least one number (0–9)", test: (p: string) => /\d/.test(p) },
  { key: "special", label: "One special character (@ # $ ! %)", message: "Password must contain at least one special character (e.g. @ # $ ! %)", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
  { key: "noSpace", label: "No spaces", message: "Password must not contain spaces", test: (p: string) => !/\s/.test(p) },
];

// First rule the password breaks, or null if it passes them all
export function passwordError(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length > 64) return "Password must be at most 64 characters long";
  return PASSWORD_RULES.find((r) => !r.test(password))?.message ?? null;
}

export const strongPassword = z.string().superRefine((value, ctx) => {
  const error = passwordError(value);
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
});
