import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { getCompanyHandler, listCompaniesHandler, modulesHandler, notesHandler, passwordResetHandler, statusHandler, subscriptionHandler, verificationHandler } from "./platformCompanies.controller.js";
import { companyStatusSchema, notesSchema, resetSchema, subscriptionSchema, verificationSchema } from "./platformCompanies.schema.js";
import { modulesSchema } from "./platform.schema.js";

// Platform-wide (no company scope); Super Admin only via the Companies page
const router = Router();
router.use(authenticate, requirePermission("platform.companies"));

router.get("/", listCompaniesHandler);
router.get("/:id", validate({ params: idParams }), getCompanyHandler);
router.patch("/:id/verification", validate({ params: idParams, body: verificationSchema }), verificationHandler);
router.patch("/:id/status", validate({ params: idParams, body: companyStatusSchema }), statusHandler);
router.patch("/:id/modules", validate({ params: idParams, body: modulesSchema }), modulesHandler);
router.patch("/:id/subscription", validate({ params: idParams, body: subscriptionSchema }), subscriptionHandler);
router.patch("/:id/notes", validate({ params: idParams, body: notesSchema }), notesHandler);
router.post("/:id/password-reset", validate({ params: idParams, body: resetSchema }), passwordResetHandler);

export const platformCompanyRoutes = router;
