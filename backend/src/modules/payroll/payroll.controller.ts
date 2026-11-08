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
  salaryHistory,
  listAdjustments,
  addAdjustment,
  removeAdjustment,
  setLop,
  listLoans,
  createLoan,
  updateLoan,
  loanRecoveryHistory,
  runSummary,
} from "./payroll.service.js";
import { exportRun } from "./payrollExports.service.js";

export const listSalaryStructuresHandler = asyncHandler(async (req, res) => {
  res.json(await listSalaryStructures(tenant(req).companyId));
});

export const setSalaryStructureHandler = asyncHandler(async (req, res) => {
  res.status(HttpStatus.CREATED).json(await setSalaryStructure(tenant(req).companyId, currentUser(req), req.body));
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

const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const runId = (req: { params: Record<string, string> }) => Number(req.params.runId);

export const salaryHistoryHandler = asyncHandler(async (req, res) => res.json(await salaryHistory(cid(req), Number(req.params.id))));
export const runSummaryHandler = asyncHandler(async (req, res) => res.json(await runSummary(cid(req), runId(req))));
export const listAdjustmentsHandler = asyncHandler(async (req, res) => res.json(await listAdjustments(cid(req), runId(req))));
export const addAdjustmentHandler = asyncHandler(async (req, res) => res.json(await addAdjustment(cid(req), currentUser(req), runId(req), req.body)));
export const removeAdjustmentHandler = asyncHandler(async (req, res) => res.json(await removeAdjustment(cid(req), currentUser(req), runId(req), Number(req.params.adjustmentId))));
export const setLopHandler = asyncHandler(async (req, res) => res.json(await setLop(cid(req), currentUser(req), runId(req), req.body)));
export const listLoansHandler = asyncHandler(async (req, res) => res.json(await listLoans(cid(req), (req.query as { status?: string }).status)));
export const createLoanHandler = asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await createLoan(cid(req), currentUser(req), req.body)));
export const updateLoanHandler = asyncHandler(async (req, res) => res.json(await updateLoan(cid(req), currentUser(req), Number(req.params.id), req.body)));
export const loanRecoveriesHandler = asyncHandler(async (req, res) => res.json(await loanRecoveryHistory(cid(req), Number(req.params.id))));

// GET /api/payroll/runs/:runId/export?type=register|bank|pf_ecr|esi|pt|tds
export const exportRunHandler = asyncHandler(async (req, res) => {
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, currentUser(req).id));
  const file = await exportRun(cid(req), runId(req), (req.query as { type: "register" }).type, me?.name);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
  // People left out of the PF file (no UAN) — the screen warns about them
  if (file.skipped.length) res.setHeader("X-Skipped", encodeURIComponent(file.skipped.join(", ")));
  res.setHeader("Cache-Control", "no-store");
  res.end(file.body);
});
