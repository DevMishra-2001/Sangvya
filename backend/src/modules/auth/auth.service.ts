import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { permissionsFor } from "../../config/permissions.js";
import { clearAuthCookies } from "../../utils/authCookie.js";
import { ConflictError, UnauthorizedError } from "../../utils/httpErrors.js";
import { createCompanyForUser, findCompany } from "../companies/companies.service.js";
import { findUserByEmail, findUserById, insertUser } from "../users/users.service.js";
import type { LoginInput, SignupInput } from "./auth.schema.js";
import { endSession, refreshSession, SESSION_INFO, startSession } from "./session.service.js";

// The user object every auth response returns — includes the permission list
// so the frontend can show/hide features without its own copy of the rules.
function publicUser<T extends { role: string; password_hash?: string }>(user: T) {
  const { password_hash: _hash, ...rest } = user;
  return { ...rest, permissions: permissionsFor(user.role) };
}

// The user's current company, as shown in the app (null until they create one)
async function currentCompany(companyId: number | null) {
  if (!companyId) return null;
  const company = await findCompany(companyId);
  if (!company) return null;
  const { created_at: _created, ...details } = company;
  return details;
}

// A new customer: creates their superadmin login. They then create their company
// (POST /api/companies). Clients may send companyName to do both in one call.
export async function signup(req: Request, res: Response, input: SignupInput) {
  if (await findUserByEmail(input.email)) throw new ConflictError("An account with this email already exists");

  const created = await insertUser({
    companyId: null,
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
    role: "superadmin",
  });
  if (input.companyName) {
    await createCompanyForUser(created, {
      companyName: input.companyName,
      industry: input.industry ?? null,
      designation: input.designation ?? "Founder",
    });
  }

  const user = (await findUserById(created.id))!;
  await startSession(res, req, user); // tokens go in HttpOnly cookies, never in the body
  return { user: publicUser(user), company: await currentCompany(user.company_id), session: SESSION_INFO };
}

export async function login(req: Request, res: Response, { email, password }: LoginInput) {
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new UnauthorizedError("Invalid email or password");
  }
  await startSession(res, req, user);
  return { user: publicUser(user), company: await currentCompany(user.company_id), session: SESSION_INFO };
}

export async function me(userId: number) {
  const user = await findUserById(userId);
  if (!user) throw new UnauthorizedError("Account no longer exists", "SESSION_REVOKED");
  return { user: publicUser(user), company: await currentCompany(user.company_id), session: SESSION_INFO };
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
