const bcrypt = require("bcryptjs");
const CompanyModel = require("../models/companyModel");
const UserModel = require("../models/userModel");
const SubscriptionModel = require("../models/subscriptionModel");
const { permissionsFor } = require("../config/permissions");
const { clearAuthCookies, REFRESH_COOKIE } = require("../utils/authCookie");
const { startSession, refreshSession, endSession, ACCESS_TTL_MIN, IDLE_MIN } = require("../utils/session");

// Session timings the browser needs for its keep-alive / idle-logout timers
const SESSION_INFO = { accessTtlMin: ACCESS_TTL_MIN, idleMin: IDLE_MIN };

// The user object every auth response returns — includes the permission
// list so the frontend can show/hide features without its own copy of the
// rules. Includes the user's own font_size setting.
function publicUser(user) {
  const { password_hash, ...rest } = user;
  return { ...rest, permissions: permissionsFor(user.role) };
}


// POST /api/auth/signup
// Creates a new company AND its first superadmin user in one call — this is
// how a new customer onboards onto the SaaS.
async function signup(req, res) {
  const { companyName, industry, name, email, password } = req.body;

  const existing = await UserModel.findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const company = await CompanyModel.create({ name: companyName, industry });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({
    companyId: company.id,
    name,
    email,
    passwordHash,
    role: "superadmin",
  });

  // Every new company starts on a free trial — no card required up front.
  // Billing kicks in once they subscribe from the Billing page (or the
  // trial lapses, if that gate is enforced — see requireActiveSubscription).
  const trialDays = Number(process.env.TRIAL_DAYS || 14);
  await SubscriptionModel.createTrial(company.id, trialDays);

  await startSession(res, req, user); // tokens go in HttpOnly cookies, never in the body
  res.status(201).json({ user: publicUser(user), company, session: SESSION_INFO });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  const user = await UserModel.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  await startSession(res, req, user);
  res.json({ user: publicUser(user), session: SESSION_INFO });
}

// GET /api/auth/me
async function me(req, res) {
  const user = await UserModel.findById(req.user.id);
  res.json({ user: publicUser(user), session: SESSION_INFO });
}

// POST /api/auth/refresh — swap the refresh cookie for a fresh access token.
// The browser calls this every few minutes only while the user is active.
async function refresh(req, res) {
  const result = await refreshSession(res, req.cookies?.[REFRESH_COOKIE], (id) => UserModel.findById(id));
  if (!result.ok) {
    clearAuthCookies(res);
    return res.status(401).json({ error: result.error, code: result.code });
  }
  res.json({ success: true, session: SESSION_INFO });
}

// POST /api/auth/logout — ends this session on the server and drops the cookies
async function logout(req, res) {
  await endSession(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  res.json({ success: true });
}

module.exports = { signup, login, me, refresh, logout };
