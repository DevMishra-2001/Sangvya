import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { generatePayslipPDF } from "../../utils/pdfGenerator.js";
import { tenant } from "../../utils/requestContext.js";
import {
  getPayslipForPdf,
  listPayslipsForRun,
  listRuns,
  listSalaryStructures,
  runPayroll,
  setSalaryStructure,
} from "./payroll.service.js";

// GET /api/payroll/salary-structure
export const listSalaryStructuresHandler = asyncHandler(async (req, res) => {
  res.json(await listSalaryStructures(tenant(req).companyId));
});

// POST /api/payroll/salary-structure
export const setSalaryStructureHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await setSalaryStructure(tenant(req).companyId, req.body));
});

// POST /api/payroll/run  { month, year }
export const runPayrollHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await runPayroll(tenant(req).companyId, req.body));
});

// GET /api/payroll/runs
export const listRunsHandler = asyncHandler(async (req, res) => {
  res.json(await listRuns(tenant(req).companyId));
});

// GET /api/payroll/runs/:runId/payslips
export const listPayslipsHandler = asyncHandler(async (req, res) => {
  res.json(await listPayslipsForRun(tenant(req).companyId, Number(req.params.runId)));
});

// GET /api/payroll/payslips/:id/pdf
export const payslipPdfHandler = asyncHandler(async (req, res) => {
  const payslip = await getPayslipForPdf(tenant(req).companyId, Number(req.params.id));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=payslip.pdf");
  generatePayslipPDF(payslip).pipe(res);
});
