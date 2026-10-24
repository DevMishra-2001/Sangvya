// Mirror of backend/src/utils/passwordPolicy.js — used for live hints and to
// catch mistakes before submitting. The backend enforces the same rules.
export const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", message: "Password must be at least 8 characters long", test: (p) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter (A–Z)", message: "Password must contain at least one uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "lower", label: "One lowercase letter (a–z)", message: "Password must contain at least one lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { key: "number", label: "One number (0–9)", message: "Password must contain at least one number (0–9)", test: (p) => /\d/.test(p) },
  { key: "special", label: "One special character (@ # $ ! %)", message: "Password must contain at least one special character (e.g. @ # $ ! %)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  { key: "noSpace", label: "No spaces", message: "Password must not contain spaces", test: (p) => !/\s/.test(p) },
];

// First rule the password breaks, or null if it passes them all.
export function passwordError(password) {
  if (!password) return "Password is required";
  if (password.length > 64) return "Password must be at most 64 characters long";
  const failed = PASSWORD_RULES.find((r) => !r.test(password));
  return failed ? failed.message : null;
}
