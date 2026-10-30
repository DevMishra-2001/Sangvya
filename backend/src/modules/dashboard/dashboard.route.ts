import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { tenant } from "../../utils/requestContext.js";
import { companyOverview } from "./dashboard.service.js";

// GET /api/dashboard/overview — the company at a glance (Admin / HR roles)
const router = Router();
router.use(authenticate, scopeToCompany);
router.get(
  "/overview",
  requirePermission("dashboard.company"),
  asyncHandler(async (req, res) => {
    res.json(await companyOverview(tenant(req).companyId));
  }),
);

export const dashboardRoutes = router;
