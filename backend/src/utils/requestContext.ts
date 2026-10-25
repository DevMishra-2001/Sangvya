import type { Request } from "express";
import { ForbiddenError, UnauthorizedError } from "./httpErrors.js";

// The logged-in user (route must run `authenticate` first).
export function currentUser(req: Request): Express.AuthUser {
  if (!req.user) throw new UnauthorizedError("Not logged in", "NO_TOKEN");
  return req.user;
}

// The logged-in user and their company (route must run `authenticate` + `scopeToCompany`).
export function tenant(req: Request): { user: Express.AuthUser; companyId: number } {
  const user = currentUser(req);
  if (!req.companyId) throw new ForbiddenError("Create your company first", "NO_COMPANY");
  return { user, companyId: req.companyId };
}
