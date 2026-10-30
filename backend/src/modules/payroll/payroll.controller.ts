import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { generatePayslipPDF } from "../../utils/pdfGenerator.js";
import { loadBrand } from "../reports/branding.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import {
  deleteRun,
  finalizeRun,
  getPayslipForPdf,
  getSettings,
  listPayslipsForRun,
  listRuns,
  listSalaryStructures,
  recalculateRun,
  runPayroll,
  setSalaryStructure,
  updateSettings,
} from "./payroll.service.js";

export const listSalaryStructuresHandler = asyncHandler(async (req, res) => {
  res.json(await listSalaryStructures(tenant(req).companyId));
});

export const setSalaryStructureHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await setSalaryStructure(tenant(req).companyId, req.body));
});

export const getSettingsHandler = asyncHandler(async (req, res) => {
  res.json({ settings: await getSettings(tenant(req).companyId) });
});

export const updateSettingsHandler = asyncHandler(async (req, res) => {
  res.json(await updateSettings(tenant(req).companyId, currentUser(req), req.body));
});

// POST /api/payroll/run  { month, year } → a draft
export const runPayrollHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await runPayroll(tenant(req).companyId, currentUser(req), req.body));
});

export const recalculateHandler = asyncHandler(async (req, res) => {
  res.json(await recalculateRun(tenant(req).companyId, currentUser(req), Number(req.params.runId)));
});

export const finalizeHandler = asyncHandler(async (req, res) => {
  res.json(await finalizeRun(tenant(req).companyId, currentUser(req), Number(req.params.runId)));
});

export const deleteRunHandler = asyncHandler(async (req, res) => {
  await deleteRun(tenant(req).companyId, currentUser(req), Number(req.params.runId));
  res.json({ success: true });
});

export const listRunsHandler = asyncHandler(async (req, res) => {
  res.json(await listRuns(tenant(req).companyId));
});

export const listPayslipsHandler = asyncHandler(async (req, res) => {
  res.json(await listPayslipsForRun(tenant(req).companyId, Number(req.params.runId)));
});

// GET /api/payroll/payslips/:id/pdf (HR) and /api/me/payslips/:id/pdf (own, finalized)
export const payslipPdfHandler = asyncHandler(async (req, res) => {
  const own = req.baseUrl.endsWith("/me");
  const payslip = await getPayslipForPdf(tenant(req).companyId, Number(req.params.id), own ? currentUser(req).employeeId! : undefined);
  const name = `payslip-${payslip.year}-${String(payslip.month).padStart(2, "0")}-${payslip.employee_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  const { companyId } = tenant(req);
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, currentUser(req).id));
  const pdf = await generatePayslipPDF(payslip, await loadBrand(companyId), me?.name);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${name}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(pdf);
});
