import { and, asc, between, count, desc, eq, getTableColumns, gte, lte, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { attendance, companies, designations, employees, leaveRequests, payrollRuns, payslips, salaryStructures } from "../../db/schema.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { calculatePayslip, type PayslipCalculation } from "../../utils/payrollCalculations.js";
import { getEmployeeById } from "../employees/employees.service.js";
import type { RunPayrollInput, SalaryStructureInput } from "./payroll.schema.js";

// ---- Salary structures ----

// A new row per revision — effective_from keeps the history
export async function setSalaryStructure(companyId: number, input: SalaryStructureInput) {
  await getEmployeeById(companyId, input.employeeId); // must be this company's employee
  const [structure] = await db
    .insert(salaryStructures)
    .values({
      company_id: companyId,
      employee_id: input.employeeId,
      basic: String(input.basic),
      hra: String(input.hra ?? 0),
      allowances: String(input.allowances ?? 0),
      ...(input.effectiveFrom ? { effective_from: input.effectiveFrom } : {}), // default: today
    })
    .returning();
  return { structure };
}

// Each employee's latest structure
function latestStructures(companyId: number) {
  return db
    .selectDistinctOn([salaryStructures.employee_id], { ...getTableColumns(salaryStructures), employee_name: employees.name })
    .from(salaryStructures)
    .innerJoin(employees, eq(employees.id, salaryStructures.employee_id))
    .where(eq(salaryStructures.company_id, companyId))
    .orderBy(salaryStructures.employee_id, desc(salaryStructures.effective_from));
}

export async function listSalaryStructures(companyId: number) {
  return { structures: await latestStructures(companyId) };
}

// ---- Payroll run ----

// Paid days for an employee in a month: present = 1, half day = 0.5,
// approved leave = paid, everything else (absent / unmarked) = unpaid.
async function getPaidDays(companyId: number, employeeId: number, month: number, year: number) {
  const totalDays = new Date(year, month, 0).getDate(); // days in month
  const mm = String(month).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${totalDays}`;

  const byStatus = await db
    .select({ status: attendance.status, cnt: count() })
    .from(attendance)
    .where(and(eq(attendance.company_id, companyId), eq(attendance.employee_id, employeeId), between(attendance.date, start, end)))
    .groupBy(attendance.status);

  let paidDays = 0;
  for (const row of byStatus) {
    if (row.status === "present") paidDays += row.cnt;
    else if (row.status === "half") paidDays += row.cnt * 0.5;
  }

  const leaves = await db
    .select({ from_date: leaveRequests.from_date, to_date: leaveRequests.to_date })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.company_id, companyId),
        eq(leaveRequests.employee_id, employeeId),
        eq(leaveRequests.status, "approved"),
        // Old-style comp off claims sat on the Sunday already counted as present; skip those
        sql`NOT (${leaveRequests.leave_type} = 'comp_off' AND extract(dow from ${leaveRequests.from_date}) = 0)`,
        lte(leaveRequests.from_date, end),
        gte(leaveRequests.to_date, start),
      ),
    );
  for (const l of leaves) {
    const from = l.from_date > start ? l.from_date : start;
    const to = l.to_date < end ? l.to_date : end;
    paidDays += Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1);
  }

  return { paidDays: Math.min(paidDays, totalDays), totalDays };
}

// Runs payroll for every employee with a salary structure, for the given month.
// All payslips are written in one transaction — a failure leaves no half-run.
export async function runPayroll(companyId: number, { month, year }: RunPayrollInput) {
  const [existing] = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.company_id, companyId), eq(payrollRuns.month, month), eq(payrollRuns.year, year)));
  if (existing) throw new ConflictError(`Payroll for ${month}/${year} has already been run`);

  const structures = await latestStructures(companyId);
  if (structures.length === 0) throw new BadRequestError("No employees have a salary structure set yet");

  const computed: { employeeId: number; calc: PayslipCalculation; paidDays: number; totalDays: number }[] = [];
  for (const s of structures) {
    const { paidDays, totalDays } = await getPaidDays(companyId, s.employee_id, month, year);
    const calc = calculatePayslip({
      basic: Number(s.basic),
      hra: Number(s.hra),
      allowances: Number(s.allowances),
      paidDays,
      totalDays,
    });
    computed.push({ employeeId: s.employee_id, calc, paidDays, totalDays });
  }

  return db.transaction(async (tx) => {
    const [run] = await tx.insert(payrollRuns).values({ company_id: companyId, month, year }).returning();
    const slips = await tx
      .insert(payslips)
      .values(
        computed.map(({ employeeId, calc, paidDays, totalDays }) => ({
          company_id: companyId,
          payroll_run_id: run.id,
          employee_id: employeeId,
          basic: String(calc.basic),
          hra: String(calc.hra),
          allowances: String(calc.allowances),
          gross: String(calc.gross),
          paid_days: String(paidDays),
          total_days: totalDays,
          pf_employee: String(calc.pfEmployee),
          pf_employer: String(calc.pfEmployer),
          esi_employee: String(calc.esiEmployee),
          esi_employer: String(calc.esiEmployer),
          professional_tax: String(calc.professionalTax),
          tds: String(calc.tds),
          total_deductions: String(calc.totalDeductions),
          net_pay: String(calc.netPay),
        })),
      )
      .returning();
    return { run, payslips: slips };
  });
}

export async function listRuns(companyId: number) {
  const runs = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.company_id, companyId))
    .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
  return { runs };
}

export async function listPayslipsForRun(companyId: number, runId: number) {
  const rows = await db
    .select({ ...getTableColumns(payslips), employee_name: employees.name, designation: designations.name })
    .from(payslips)
    .innerJoin(employees, eq(employees.id, payslips.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .where(and(eq(payslips.company_id, companyId), eq(payslips.payroll_run_id, runId)))
    .orderBy(asc(employees.name));
  return { payslips: rows };
}

// One payslip with everything the PDF prints
export async function getPayslipForPdf(companyId: number, id: number) {
  const [payslip] = await db
    .select({
      ...getTableColumns(payslips),
      employee_name: employees.name,
      designation: designations.name,
      department: employees.department,
      company_name: companies.name,
      month: payrollRuns.month,
      year: payrollRuns.year,
    })
    .from(payslips)
    .innerJoin(employees, eq(employees.id, payslips.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .innerJoin(companies, eq(companies.id, payslips.company_id))
    .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payroll_run_id))
    .where(and(eq(payslips.company_id, companyId), eq(payslips.id, id)));
  if (!payslip) throw new NotFoundError("Payslip not found");
  return payslip;
}
