import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  listPayslipsHandler,
  listRunsHandler,
  listSalaryStructuresHandler,
  payslipPdfHandler,
  runPayrollHandler,
  setSalaryStructureHandler,
} from "./payroll.controller.js";
import { runIdParams, runPayrollSchema, salaryStructureSchema } from "./payroll.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

router.get("/salary-structure", requirePermission("payroll.view"), listSalaryStructuresHandler);
router.post("/salary-structure", requirePermission("payroll.manage"), validate({ body: salaryStructureSchema }), setSalaryStructureHandler);
router.post("/run", requirePermission("payroll.manage"), validate({ body: runPayrollSchema }), runPayrollHandler);
router.get("/runs", requirePermission("payroll.view"), listRunsHandler);
router.get("/runs/:runId/payslips", requirePermission("payroll.view"), validate({ params: runIdParams }), listPayslipsHandler);
router.get("/payslips/:id/pdf", requirePermission("payroll.view"), validate({ params: idParams }), payslipPdfHandler);

export const payrollRoutes = router;
