import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { listRolesHandler, updateRoleHandler } from "./roles.controller.js";
import { updateRoleSchema } from "./roles.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", listRolesHandler);
router.patch("/:id", requirePermission("roles.manage"), validate({ params: idParams, body: updateRoleSchema }), updateRoleHandler);

export const roleRoutes = router;
