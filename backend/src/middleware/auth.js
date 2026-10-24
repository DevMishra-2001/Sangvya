const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel");
const { can } = require("../config/permissions");
const SessionModel = require("../models/sessionModel");
const { ACCESS_COOKIE } = require("../utils/authCookie");

// Verifies the short-lived access JWT and attaches the current user (id,
// companyId, role, employeeId, sessionId) to req.user. The browser app sends
// the token in an HttpOnly cookie; API tools may send "Authorization: Bearer".
// 401 codes tell the frontend what to do:
//   TOKEN_EXPIRED / NO_TOKEN → try POST /auth/refresh, then retry
//   SESSION_REVOKED          → logged out (logout elsewhere, password changed…)
// The session row and the user are re-read every request, so a logout, role
// change or deleted account takes effect immediately.
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = req.cookies?.[ACCESS_COOKIE] || (header?.startsWith("Bearer ") ? header.split(" ")[1] : null);
  if (!token) {
    return res.status(401).json({ error: "Not logged in", code: "NO_TOKEN" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    return res.status(401).json({ error: expired ? "Session token expired" : "Invalid token", code: expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN" });
  }

  try {
    const session = decoded.sid ? await SessionModel.findById(decoded.sid) : null;
    if (!session || session.revoked_at || session.user_id !== decoded.id) {
      return res.status(401).json({ error: "Your session has ended. Please log in again.", code: "SESSION_REVOKED" });
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Account no longer exists", code: "SESSION_REVOKED" });

    // The cookie is shared by every tab. If another tab logged in as someone
    // else, this tab (which says who it expects) must not act as that user.
    const expected = req.headers["x-expected-user"];
    if (expected && expected !== user.id) {
      return res.status(409).json({ error: "You logged in as a different user in another tab", code: "SESSION_CHANGED" });
    }

    req.user = {
      id: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
      employeeId: user.employee_id,
      sessionId: session.id,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Restricts a route to specific roles, e.g. requireRole("superadmin", "hr").
// Prefer requirePermission so access rules stay in config/permissions.js.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission for this action" });
    }
    next();
  };
}

// Restricts a route to roles holding a permission, e.g. requirePermission("leave.approve")
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !can(req.user.role, permission)) {
      return res.status(403).json({ error: "You don't have permission for this action" });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, requirePermission };
