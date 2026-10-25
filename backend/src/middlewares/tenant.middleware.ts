import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/httpErrors.js";

// Multi-tenant safety net. After `authenticate`, req.user.companyId is trusted
// (it came from a signed token, not from the request body/query). This makes it
// explicit as req.companyId, so services never trust a client-supplied company id.
export function scopeToCompany(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new UnauthorizedError("Not logged in", "NO_TOKEN"));
  // A new superadmin who hasn't created their company yet (the frontend sends them to set it up)
  if (!req.user.companyId) return next(new ForbiddenError("Create your company first", "NO_COMPANY"));
  req.companyId = req.user.companyId;
  next();
}
