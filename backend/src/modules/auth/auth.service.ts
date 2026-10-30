import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { teamSize } from "../self/team.service.js";
import { clearAuthCookies } from "../../utils/authCookie.js";
import { ForbiddenError, UnauthorizedError } from "../../utils/httpErrors.js";
import { findCompany } from "../companies/companies.service.js";
import { accessFor } from "../pages/access.service.js";
import { findUserByEmail, findUserById } from "../users/users.service.js";
import type { LoginInput } from "./auth.schema.js";
import { endSession, refreshSession, reissueAccessToken, SESSION_INFO, startSession } from "./session.service.js";

interface AuthUserRow {
  id: number;
  company_id: number | null;
  employee_id: number | null;
  role: string;
  password_hash?: string;
}

// What every auth response returns. `pages` is the user's menu and page access
// (from the Page Master) — the frontend loads it once with this call and keeps it.
export async function authPayload<T extends AuthUserRow>(user: T) {
  const { password_hash: _hash, ...rest } = user;
  const access = await accessFor(user);
  return {
    user: {
      ...rest,
      role: access.role,
      is_superadmin: access.isSuperadmin,
      permissions: access.permissions,
      // People who report to me — the "My team" page shows only for managers
      team_size: await teamSize(user.company_id, user.employee_id),
    },
    company: await currentCompany(user.company_id),
    pages: access.pages,
    session: SESSION_INFO,
  };
}

// The user's current company, as shown in the app (null until they create one)
async function currentCompany(companyId: number | null) {
  if (!companyId) return null;
  const company = await findCompany(companyId);
  if (!company) return null;
  // Tax IDs and billing details stay out of what every employee's browser gets
  // (and so do the Super Admin's review notes)
  const {
    created_at: _created,
    pan: _pan,
    gstin: _gstin,
    cin_llpin: _cin,
    tan: _tan,
    billing_address: _billing,
    verification_notes: _notes,
    status_reason: _reason,
    reviewed_by: _reviewer,
    ...details
  } = company;
  return details;
}

export async function login(req: Request, res: Response, { email, password }: LoginInput) {
  const user = await findUserByEmail(email);
  // Invited but not activated yet: there's no password to check
  if (user && !user.activated_at) {
    throw new ForbiddenError("Your account isn't activated yet. Use the activation link from your invitation email.", "NOT_ACTIVATED");
  }
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new UnauthorizedError("Invalid email or password");
  }
  if (user.is_blocked) throw new ForbiddenError("Your login has been blocked. Please contact your company admin.", "LOGIN_BLOCKED");
  await startSession(res, req, user);
  return authPayload(user);
}

// GET /auth/me (each app load): also renews the access token, so the pages it
// lists for the proxy's page guard always match the menu sent here — e.g. right
// after a page is added in the Page Master or by a migration.
export async function meWithFreshToken(res: Response, userId: number, sessionId: number) {
  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedError("Account no longer exists", "SESSION_REVOKED");
  await reissueAccessToken(res, user, sessionId);
  return authPayload(user);
}

export async function me(userId: number) {
  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedError("Account no longer exists", "SESSION_REVOKED");
  return authPayload(user);
}

// Swap the refresh cookie for a fresh access token. The browser calls this
// every few minutes only while the user is active.
export async function refresh(res: Response, refreshToken: string | undefined) {
  const result = await refreshSession(res, refreshToken, findUserById);
  if (!result.ok) {
    clearAuthCookies(res);
    throw new UnauthorizedError(result.error, result.code);
  }
  return { success: true, session: SESSION_INFO };
}

// Ends this session on the server and drops the cookies
export async function logout(res: Response, refreshToken: string | undefined) {
  await endSession(refreshToken);
  clearAuthCookies(res);
  return { success: true };
}
