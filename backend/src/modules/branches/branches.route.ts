import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { branchSchema } from "./branches.schema.js";
import { createBranch, deleteBranch, listBranches, updateBranch } from "./branches.service.js";

// Branches / offices: anyone in the company can list them; Admin manages them
const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", asyncHandler(async (req, res) => res.json(await listBranches(tenant(req).companyId))));
router.post(
  "/",
  requirePermission("company.manage"),
  validate({ body: branchSchema }),
  asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createBranch(tenant(req).companyId, currentUser(req), req.body))),
);
router.put(
  "/:id",
  requirePermission("company.manage"),
  validate({ params: idParams, body: branchSchema }),
  asyncHandler(async (req, res) => res.json(await updateBranch(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body))),
);
router.delete(
  "/:id",
  requirePermission("company.manage"),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteBranch(tenant(req).companyId, currentUser(req), Number(req.params.id));
    res.json({ success: true });
  }),
);

export const branchRoutes = router;
