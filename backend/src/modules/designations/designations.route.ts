import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { listDesignationsHandler, updateDesignationHandler } from "./designations.controller.js";
import { updateDesignationSchema } from "./designations.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", listDesignationsHandler);
router.patch("/:id", requirePermission("designations.manage"), validate({ params: idParams, body: updateDesignationSchema }), updateDesignationHandler);

export const designationRoutes = router;
