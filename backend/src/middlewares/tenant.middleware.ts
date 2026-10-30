import type { NextFunction, Request, Response } from "express";
import { isCompanySuspended } from "../utils/companyStatus.js";
import { ForbiddenError, UnauthorizedError } from "../utils/httpErrors.js";

// Multi-tenant safety net. After `authenticate`, req.user.companyId is trusted
// (it came from a signed token, not from the request body/query). This makes it
// explicit as req.companyId, so services never trust a client-supplied company id.
// A suspended company can't be used (except by the Super Admin, who manages it).
export async function scopeToCompany(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError("Not logged in", "NO_TOKEN");
    // A new Admin who hasn't created their company yet (the frontend sends them to set it up)
    if (!req.user.companyId) throw new ForbiddenError("Create your company first", "NO_COMPANY");
    if (!req.user.isSuperadmin && (await isCompanySuspended(req.user.companyId))) {
      throw new ForbiddenError("This company's account is suspended. Please contact Workkind support.", "COMPANY_SUSPENDED");
    }
    req.companyId = req.user.companyId;
    next();
  } catch (err) {
    next(err);
  }
}
