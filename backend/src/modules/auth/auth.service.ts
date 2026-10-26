import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { clearAuthCookies } from "../../utils/authCookie.js";
import { ForbiddenError, UnauthorizedError } from "../../utils/httpErrors.js";
import { findCompany } from "../companies/companies.service.js";
import { accessFor } from "../pages/access.service.js";
import { findUserByEmail, findUserById } from "../users/users.service.js";
import type { LoginInput } from "./auth.schema.js";
import { endSession, refreshSession, SESSION_INFO, startSession } from "./session.service.js";

interface AuthUserRow {
  id: number;
  company_id: number | null;
  employee_id: number | null;
  role: string;
  password_hash?: string;
}

// What every auth response returns. `pages` is the user's menu and page access
// (from the Page Master) — the frontend loads it once with this call and keeps it.
async function authPayload<T extends AuthUserRow>(user: T) {
  const { password_hash: _hash, ...rest } = user;
  const access = await accessFor(user);
  return {
    user: { ...rest, designation: access.designation, is_superadmin: access.isSuperadmin, permissions: access.permissions },
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
  const { created_at: _created, ...details } = company;
  return details;
}

export async function login(req: Request, res: Response, { email, password }: LoginInput) {
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new UnauthorizedError("Invalid email or password");
  }
  if (user.is_blocked) throw new ForbiddenError("Your login has been blocked. Please contact your company admin.", "LOGIN_BLOCKED");
  await startSession(res, req, user);
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
