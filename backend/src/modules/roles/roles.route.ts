import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { listRolesHandler, updateRoleHandler } from "./roles.controller.js";
import { updateRoleSchema } from "./roles.schema.js";

// Roles are platform-wide, so no company is needed (the Super Admin uses them
// in Page Master and Roles before having one)
const router = Router();
router.use(authenticate);

router.get("/", listRolesHandler);
router.patch("/:id", requirePermission("roles.manage"), validate({ params: idParams, body: updateRoleSchema }), updateRoleHandler);

export const roleRoutes = router;
