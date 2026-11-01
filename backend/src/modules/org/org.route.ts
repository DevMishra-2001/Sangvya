import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { pageQuery } from "../../utils/pagination.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { departmentMembers, overview, reportsOf } from "./org.service.js";

const membersQuery = z.object({ ...pageQuery, search: z.string().trim().max(100).optional().catch(undefined) });
const deptParams = z.object({ id: z.union([z.literal("none"), z.coerce.number().int().positive()]) });

// Org chart — open to everyone the page is given to (names, titles and teams only)
const router = Router();
router.use(authenticate, scopeToCompany, requirePermission("org.view"));

router.get("/", asyncHandler(async (req, res) => res.json(await overview(tenant(req).companyId, currentUser(req).employeeId))));
router.get(
  "/departments/:id/members",
  validate({ params: deptParams, query: membersQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof membersQuery>;
    res.json(await departmentMembers(tenant(req).companyId, req.params.id as unknown as number | "none", q));
  }),
);
router.get("/:id/reports", validate({ params: idParams }), asyncHandler(async (req, res) => res.json({ reports: await reportsOf(tenant(req).companyId, Number(req.params.id)) })));

export const orgRoutes = router;
