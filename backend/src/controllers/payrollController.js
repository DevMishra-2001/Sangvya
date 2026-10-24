const SalaryStructureModel = require("../models/salaryModel");
const PayrollModel = require("../models/payrollModel");
const EmployeeModel = require("../models/employeeModel");
const { query } = require("../config/db");
const { calculatePayslip } = require("../utils/payrollCalculations");
const { generatePayslipPDF } = require("../utils/pdfGenerator");

// POST /api/payroll/salary-structure
async function setSalaryStructure(req, res) {
  const { employeeId, basic, hra, allowances, effectiveFrom } = req.body;
  const structure = await SalaryStructureModel.set(req.companyId, {
    employeeId, basic, hra, allowances: allowances || 0, effectiveFrom,
  });
  res.status(201).json({ structure });
}

// GET /api/payroll/salary-structure
async function listSalaryStructures(req, res) {
  const structures = await SalaryStructureModel.listForCompany(req.companyId);
  res.json({ structures });
}

// Count paid days for an employee in a given month:
// present = 1 day, half day = 0.5, approved leave = counted as paid,
// everything else (absent / unmarked) = unpaid.
async function getPaidDays(companyId, employeeId, month, year) {
  const totalDays = new Date(year, month, 0).getDate(); // days in month
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${totalDays}`;

  const attendanceRes = await query(
    `SELECT status, COUNT(*) as cnt FROM attendance
     WHERE company_id = $1 AND employee_id = $2 AND date BETWEEN $3 AND $4
     GROUP BY status`,
    [companyId, employeeId, start, end]
  );

  let paidDays = 0;
  for (const row of attendanceRes.rows) {
    if (row.status === "present") paidDays += Number(row.cnt);
    else if (row.status === "half") paidDays += Number(row.cnt) * 0.5;
  }

  const leaveRes = await query(
    `SELECT from_date, to_date FROM leave_requests
     WHERE company_id = $1 AND employee_id = $2 AND status = 'approved'
       -- Old-style comp off claims sat on the Sunday already counted as present; skip those
       AND NOT (leave_type = 'comp_off' AND EXTRACT(DOW FROM from_date) = 0)
       AND from_date <= $4 AND to_date >= $3`,
    [companyId, employeeId, start, end]
  );
  for (const l of leaveRes.rows) {
    const from = l.from_date > start ? l.from_date : start;
    const to = l.to_date < end ? l.to_date : end;
    const days = (new Date(to) - new Date(from)) / 86400000 + 1;
    paidDays += Math.max(0, days);
  }

  return { paidDays: Math.min(paidDays, totalDays), totalDays };
}

// POST /api/payroll/run  { month, year }
// Runs payroll for every employee with a salary structure, for the given month.
async function runPayroll(req, res) {
  const { month, year } = req.body;

  const existing = await PayrollModel.findRun(req.companyId, month, year);
  if (existing) {
    return res.status(409).json({ error: `Payroll for ${month}/${year} has already been run` });
  }

  const structures = await SalaryStructureModel.listForCompany(req.companyId);
  if (structures.length === 0) {
    return res.status(400).json({ error: "No employees have a salary structure set yet" });
  }

  const run = await PayrollModel.createRun(req.companyId, month, year);
  const payslips = [];

  for (const s of structures) {
    const { paidDays, totalDays } = await getPaidDays(req.companyId, s.employee_id, month, year);
    const calc = calculatePayslip({
      basic: Number(s.basic),
      hra: Number(s.hra),
      allowances: Number(s.allowances),
      paidDays,
      totalDays,
    });
    const payslip = await PayrollModel.insertPayslip(
      req.companyId, run.id, s.employee_id, calc, paidDays, totalDays
    );
    payslips.push(payslip);
  }

  res.status(201).json({ run, payslips });
}

// GET /api/payroll/runs
async function listRuns(req, res) {
  const runs = await PayrollModel.listRuns(req.companyId);
  res.json({ runs });
}

// GET /api/payroll/runs/:runId/payslips
async function listPayslipsForRun(req, res) {
  const payslips = await PayrollModel.listPayslipsForRun(req.companyId, req.params.runId);
  res.json({ payslips });
}

// GET /api/payroll/payslips/:id/pdf
async function downloadPayslipPDF(req, res) {
  const payslip = await PayrollModel.getPayslip(req.companyId, req.params.id);
  if (!payslip) return res.status(404).json({ error: "Payslip not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=payslip.pdf`);
  generatePayslipPDF(payslip).pipe(res);
}

module.exports = {
  setSalaryStructure, listSalaryStructures, runPayroll, listRuns, listPayslipsForRun, downloadPayslipPDF,
};
