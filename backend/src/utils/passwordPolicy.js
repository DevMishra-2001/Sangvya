// The one password policy for every place a password is set (signup, creating
// a user, change password, forgot-password reset). The frontend mirrors these
// rules for live hints, but this is the check that actually counts.
const PASSWORD_RULES = [
  { key: "length", message: "Password must be at least 8 characters long", test: (p) => p.length >= 8 },
  { key: "upper", message: "Password must contain at least one uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "lower", message: "Password must contain at least one lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { key: "number", message: "Password must contain at least one number (0–9)", test: (p) => /\d/.test(p) },
  { key: "special", message: "Password must contain at least one special character (e.g. @ # $ ! %)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  { key: "noSpace", message: "Password must not contain spaces", test: (p) => !/\s/.test(p) },
  { key: "maxLength", message: "Password must be at most 64 characters long", test: (p) => p.length <= 64 },
];

// First rule the password breaks, or null if it passes them all.
function passwordError(password) {
  if (typeof password !== "string" || password.length === 0) return "Password is required";
  const failed = PASSWORD_RULES.find((r) => !r.test(password));
  return failed ? failed.message : null;
}

// express-validator chain for a password field:  strongPassword(body("newPassword"))
function strongPassword(chain) {
  return chain.custom((value) => {
    const error = passwordError(value);
    if (error) throw new Error(error);
    return true;
  });
}

module.exports = { PASSWORD_RULES, passwordError, strongPassword };
