import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { can, type Permission, type Role } from "../config/permissions.js";
import { findSessionById } from "../modules/auth/session.service.js";
import { findUserById } from "../modules/users/users.service.js";
import { ACCESS_COOKIE } from "../utils/authCookie.js";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "../utils/httpErrors.js";

export interface AccessTokenPayload {
  id: number;
  companyId: number;
  sid: number;
}

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  return req.cookies?.[ACCESS_COOKIE] || (header?.startsWith("Bearer ") ? header.split(" ")[1] : undefined);
}

// Verifies the short-lived access JWT and attaches the current user to req.user.
// The browser app sends the token in an HttpOnly cookie; API tools may send
// "Authorization: Bearer". 401 codes tell the frontend what to do:
//   TOKEN_EXPIRED / NO_TOKEN → try POST /auth/refresh, then retry
//   SESSION_REVOKED          → logged out (logout elsewhere, password changed…)
// The session row and the user are re-read every request, so a logout, role
// change or deleted account takes effect immediately.
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readToken(req);
    if (!token) throw new UnauthorizedError("Not logged in", "NO_TOKEN");

    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as unknown as AccessTokenPayload;
    } catch (err) {
      const expired = (err as Error).name === "TokenExpiredError";
      throw new UnauthorizedError(expired ? "Session token expired" : "Invalid token", expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN");
    }

    const session = decoded.sid ? await findSessionById(decoded.sid) : undefined;
    if (!session || session.revoked_at || session.user_id !== decoded.id) {
      throw new UnauthorizedError("Your session has ended. Please log in again.", "SESSION_REVOKED");
    }

    const user = await findUserById(decoded.id);
    if (!user) throw new UnauthorizedError("Account no longer exists", "SESSION_REVOKED");

    // The cookie is shared by every tab. If another tab logged in as someone
    // else, this tab (which says who it expects) must not act as that user.
    const expected = req.headers["x-expected-user"];
    if (expected && expected !== String(user.id)) {
      throw new ConflictError("You logged in as a different user in another tab", "SESSION_CHANGED");
    }

    req.user = {
      id: user.id,
      companyId: user.company_id,
      role: user.role as Role,
      email: user.email,
      employeeId: user.employee_id,
      sessionId: session.id,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Restricts a route to roles holding a permission, e.g. requirePermission("leave.approve").
// Access rules live in config/permissions.ts — routes never name roles directly.
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !can(req.user.role, permission)) return next(new ForbiddenError());
    next();
  };
}

// For /api/me routes: the login must be linked to an employee record.
export function requireEmployeeLink(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.employeeId) {
    return next(new BadRequestError("Your login isn't linked to an employee record — ask HR to link it"));
  }
  next();
}
