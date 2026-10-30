import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import { idParams } from "../../utils/zod.js";
import { customRoleSchema } from "./customRoles.schema.js";
import { createCustomRole, deleteCustomRole, listCustomRoles, updateCustomRole } from "./customRoles.service.js";

// A company's own roles (Admin): name, base role, and the pages it opens
const router = Router();
router.use(authenticate, scopeToCompany, requirePermission("roles.custom"));

router.get("/", asyncHandler(async (req, res) => res.json(await listCustomRoles(tenant(req).companyId))));
router.post(
  "/",
  validate({ body: customRoleSchema }),
  asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createCustomRole(tenant(req).companyId, currentUser(req), req.body))),
);
router.put(
  "/:id",
  validate({ params: idParams, body: customRoleSchema }),
  asyncHandler(async (req, res) => res.json(await updateCustomRole(tenant(req).companyId, currentUser(req), Number(req.params.id), req.body))),
);
router.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await deleteCustomRole(tenant(req).companyId, currentUser(req), Number(req.params.id));
    res.json({ success: true });
  }),
);

export const customRoleRoutes = router;
