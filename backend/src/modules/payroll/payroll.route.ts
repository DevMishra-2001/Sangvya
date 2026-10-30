import { Router } from "express";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import {
  deleteRunHandler,
  finalizeHandler,
  getSettingsHandler,
  listPayslipsHandler,
  listRunsHandler,
  listSalaryStructuresHandler,
  payslipPdfHandler,
  recalculateHandler,
  runPayrollHandler,
  setSalaryStructureHandler,
  updateSettingsHandler,
} from "./payroll.controller.js";
import { payrollSettingsSchema, runIdParams, runPayrollSchema, salaryStructureSchema } from "./payroll.schema.js";

const router = Router();
router.use(authenticate, scopeToCompany);

const view = requirePermission("payroll.view");
const manage = requirePermission("payroll.manage");

router.get("/salary-structure", view, listSalaryStructuresHandler);
router.post("/salary-structure", manage, validate({ body: salaryStructureSchema }), setSalaryStructureHandler);
router.get("/settings", view, getSettingsHandler);
router.put("/settings", manage, validate({ body: payrollSettingsSchema }), updateSettingsHandler);
router.post("/run", manage, validate({ body: runPayrollSchema }), runPayrollHandler);
router.get("/runs", view, listRunsHandler);
router.get("/runs/:runId/payslips", view, validate({ params: runIdParams }), listPayslipsHandler);
router.post("/runs/:runId/recalculate", manage, validate({ params: runIdParams }), recalculateHandler);
router.post("/runs/:runId/finalize", manage, validate({ params: runIdParams }), finalizeHandler);
router.delete("/runs/:runId", manage, validate({ params: runIdParams }), deleteRunHandler);
router.get("/payslips/:id/pdf", view, validate({ params: idParams }), payslipPdfHandler);

export const payrollRoutes = router;
