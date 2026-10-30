import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { getCompanyHandler, listCompaniesHandler, modulesHandler, statusHandler, verificationHandler } from "./platformCompanies.controller.js";
import { companyStatusSchema, verificationSchema } from "./platformCompanies.schema.js";
import { modulesSchema } from "./platform.schema.js";

// Platform-wide (no company scope); Super Admin only via the Companies page
const router = Router();
router.use(authenticate, requirePermission("platform.companies"));

router.get("/", listCompaniesHandler);
router.get("/:id", validate({ params: idParams }), getCompanyHandler);
router.patch("/:id/verification", validate({ params: idParams, body: verificationSchema }), verificationHandler);
router.patch("/:id/status", validate({ params: idParams, body: companyStatusSchema }), statusHandler);
router.patch("/:id/modules", validate({ params: idParams, body: modulesSchema }), modulesHandler);

export const platformCompanyRoutes = router;
