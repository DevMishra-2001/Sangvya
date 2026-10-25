// The one password policy for every place a password is set (signup, creating
// a user, change password, forgot-password reset). The frontend mirrors these
// rules for live hints, but this is the check that actually counts.
import { z } from "zod";

export const PASSWORD_RULES = [
  { key: "length", message: "Password must be at least 8 characters long", test: (p: string) => p.length >= 8 },
  { key: "upper", message: "Password must contain at least one uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", message: "Password must contain at least one lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", message: "Password must contain at least one number (0–9)", test: (p: string) => /\d/.test(p) },
  { key: "special", message: "Password must contain at least one special character (e.g. @ # $ ! %)", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
  { key: "noSpace", message: "Password must not contain spaces", test: (p: string) => !/\s/.test(p) },
  { key: "maxLength", message: "Password must be at most 64 characters long", test: (p: string) => p.length <= 64 },
];

// First rule the password breaks, or null if it passes them all.
export function passwordError(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) return "Password is required";
  const failed = PASSWORD_RULES.find((r) => !r.test(password));
  return failed ? failed.message : null;
}

// Zod field for any "set a password" input
export const strongPassword = z.unknown().transform((value, ctx) => {
  const error = passwordError(value);
  if (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    return z.NEVER;
  }
  return value as string;
});
