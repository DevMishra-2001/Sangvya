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
  salaryHistoryHandler,
  runSummaryHandler,
  listAdjustmentsHandler,
  addAdjustmentHandler,
  removeAdjustmentHandler,
  setLopHandler,
  listLoansHandler,
  createLoanHandler,
  updateLoanHandler,
  loanRecoveriesHandler,
  exportRunHandler,
} from "./payroll.controller.js";
import {
  adjustmentParams,
  adjustmentSchema,
  exportQuery,
  loanListQuery,
  loanSchema,
  loanUpdateSchema,
  lopSchema,
  payrollSettingsSchema,
  runIdParams,
  runPayrollSchema,
  salaryStructureSchema,
} from "./payroll.schema.js";

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
router.get("/salary-structure/:id/history", view, validate({ params: idParams }), salaryHistoryHandler);
router.get("/runs/:runId/summary", view, validate({ params: runIdParams }), runSummaryHandler);
router.get("/runs/:runId/export", view, validate({ params: runIdParams, query: exportQuery }), exportRunHandler);
router.get("/runs/:runId/adjustments", view, validate({ params: runIdParams }), listAdjustmentsHandler);
router.post("/runs/:runId/adjustments", manage, validate({ params: runIdParams, body: adjustmentSchema }), addAdjustmentHandler);
router.delete("/runs/:runId/adjustments/:adjustmentId", manage, validate({ params: adjustmentParams }), removeAdjustmentHandler);
router.put("/runs/:runId/lop", manage, validate({ params: runIdParams, body: lopSchema }), setLopHandler);
router.get("/loans", view, validate({ query: loanListQuery }), listLoansHandler);
router.post("/loans", manage, validate({ body: loanSchema }), createLoanHandler);
router.patch("/loans/:id", manage, validate({ params: idParams, body: loanUpdateSchema }), updateLoanHandler);
router.get("/loans/:id/recoveries", view, validate({ params: idParams }), loanRecoveriesHandler);

export const payrollRoutes = router;
