import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { auditQuery, type AuditQuery } from "./platform.schema.js";
import { listAudit } from "./platformAudit.service.js";
import { platformOverview } from "./platformOverview.service.js";

// GET /api/platform/audit?action=&companyId=&q=&before=&limit=
const audit = Router();
audit.use(authenticate, requirePermission("platform.audit"));
audit.get(
  "/",
  validate({ query: auditQuery }),
  asyncHandler(async (req, res) => {
    res.json(await listAudit(req.query as unknown as AuditQuery));
  }),
);

// GET /api/platform/overview
const overview = Router();
overview.use(authenticate, requirePermission("platform.overview"));
overview.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await platformOverview());
  }),
);

export const platformAuditRoutes = audit;
export const platformOverviewRoutes = overview;
