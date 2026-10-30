import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { createDesignationHandler, deleteDesignationHandler, listDesignationsHandler, updateDesignationHandler } from "./designations.controller.js";
import { designationSchema } from "./designations.schema.js";

// A company's job titles: everyone can read them (profiles); Admin/HR manage them
const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/", listDesignationsHandler);
router.post("/", requirePermission("designations.manage"), validate({ body: designationSchema }), createDesignationHandler);
router.put("/:id", requirePermission("designations.manage"), validate({ params: idParams, body: designationSchema }), updateDesignationHandler);
router.delete("/:id", requirePermission("designations.manage"), validate({ params: idParams }), deleteDesignationHandler);

export const designationRoutes = router;
