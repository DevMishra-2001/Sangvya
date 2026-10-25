import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { createCompanyHandler, listCompaniesHandler, switchCompanyHandler } from "./companies.controller.js";
import { companyIdParams, createCompanySchema } from "./companies.schema.js";

// No scopeToCompany here: a new superadmin has no company yet
const router = Router();
router.use(authenticate);

router.get("/", listCompaniesHandler);
router.post("/", requirePermission("companies.manage"), validate({ body: createCompanySchema }), createCompanyHandler);
router.post("/:id/switch", validate({ params: companyIdParams }), switchCompanyHandler);

export const companyRoutes = router;
