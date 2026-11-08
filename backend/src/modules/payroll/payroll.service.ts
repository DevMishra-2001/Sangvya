import { and, asc, between, desc, eq, getTableColumns, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  attendance,
  companies,
  departments,
  designations,
  employeeLoans,
  employees,
  holidays,
  leaveRequests,
  loanRecoveries,
  payrollAdjustments,
  payrollLopOverrides,
  payrollRuns,
  payrollSettings,
  payslips,
  salaryStructures,
  users,
  type CtcTemplate,
} from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { calculatePayslip, type Adjustment, type Deductions } from "../../utils/payrollCalculations.js";
import { localDate } from "../../utils/workday.js";
import { workCalendar, type WorkCalendar } from "../companies/workCalendar.js";
import { getEmployeeById } from "../employees/employees.service.js";
import { notify } from "../notifications/notify.js";
import { disabledModules } from "../pages/access.service.js";
import type { AdjustmentInput, LoanInput, LoanUpdateInput, LopInput, PayrollSettingsInput, RunPayrollInput, SalaryStructureInput } from "./payroll.schema.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m: number, y: number) => `${MONTH_NAMES[m - 1]} ${y}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---- Salary structures ----

// A new row per revision — effective_from keeps the history
export async function setSalaryStructure(companyId: number, actor: Express.AuthUser, input: SalaryStructureInput) {
  const e = await getEmployeeById(companyId, input.employeeId);
  const components = (input.components ?? []).filter((c) => c.label.trim() && c.amount > 0).map((c) => ({ label: c.label.trim(), amount: Math.round(c.amount) }));
  const allowances = components.length ? components.reduce((t, c) => t + c.amount, 0) : (input.allowances ?? 0);
  const [structure] = await db
    .insert(salaryStructures)
    .values({
      company_id: companyId,
      employee_id: input.employeeId,
      basic: String(input.basic),
      hra: String(input.hra ?? 0),
      allowances: String(allowances),
      components,
      ctc_annual: input.ctcAnnual != null ? String(input.ctcAnnual) : null,
      note: input.note ?? null,
      created_by: actor.id,
      ...(input.effectiveFrom ? { effective_from: input.effectiveFrom } : {}),
    })
    .returning();
  const monthly = Number(input.basic) + Number(input.hra ?? 0) + allowances;
  audit(actor, { companyId, action: "payroll.salary_set", target: ["employee", e.id], summary: `Salary of ${e.name}: ₹${monthly.toLocaleString("en-IN")}/month from ${structure.effective_from}${input.note ? ` — ${input.note}` : ""}` });
  return { structure };
}

// Every revision for one employee, newest first
export async function salaryHistory(companyId: number, employeeId: number) {
  await getEmployeeById(companyId, employeeId);
  const rows = await db
    .select({ ...getTableColumns(salaryStructures), created_by_name: users.name })
    .from(salaryStructures)
    .leftJoin(users, eq(users.id, salaryStructures.created_by))
    .where(and(eq(salaryStructures.company_id, companyId), eq(salaryStructures.employee_id, employeeId)))
    .orderBy(desc(salaryStructures.effective_from), desc(salaryStructures.id));
  return { history: rows };
}

// Each employee's structure in effect on `asOf` (latest by default)
function structuresAsOf(companyId: number, asOf = "9999-12-31") {
  return db
    .selectDistinctOn([salaryStructures.employee_id], { ...getTableColumns(salaryStructures), employee_name: employees.name })
    .from(salaryStructures)
    .innerJoin(employees, eq(employees.id, salaryStructures.employee_id))
    .where(and(eq(salaryStructures.company_id, companyId), lte(salaryStructures.effective_from, asOf)))
    .orderBy(salaryStructures.employee_id, desc(salaryStructures.effective_from));
}

export async function listSalaryStructures(companyId: number) {
  return { structures: await structuresAsOf(companyId) };
}

// ---- Settings ----

const DEFAULT_TEMPLATE: CtcTemplate = { basicPct: 50, hraPctOfBasic: 40, conveyance: 1600, medical: 1250 };

export async function getSettings(companyId: number) {
  const [row] = await db
    .insert(payrollSettings)
    .values({ company_id: companyId })
    .onConflictDoUpdate({ target: payrollSettings.company_id, set: { company_id: sql`excluded.company_id` } })
    .returning();
  return {
    pfEnabled: row.pf_enabled,
    esiEnabled: row.esi_enabled,
    ptEnabled: row.pt_enabled,
    tdsEnabled: row.tds_enabled,
    pfCeiling: row.pf_ceiling,
    ctcTemplate: { ...DEFAULT_TEMPLATE, ...(row.ctc_template ?? {}) },
  };
}

export async function updateSettings(companyId: number, actor: Express.AuthUser, input: PayrollSettingsInput) {
  await getSettings(companyId);
  await db
    .update(payrollSettings)
    .set({
      pf_enabled: input.pfEnabled,
      esi_enabled: input.esiEnabled,
      pt_enabled: input.ptEnabled,
      tds_enabled: input.tdsEnabled,
      ...(input.pfCeiling !== undefined ? { pf_ceiling: input.pfCeiling } : {}),
      ...(input.ctcTemplate ? { ctc_template: input.ctcTemplate } : {}),
      updated_at: sql`now()`,
    })
    .where(eq(payrollSettings.company_id, companyId));
  const on = [input.pfEnabled && "PF", input.esiEnabled && "ESI", input.ptEnabled && "PT", input.tdsEnabled && "TDS"].filter(Boolean).join(", ") || "none";
  audit(actor, { companyId, action: "payroll.settings_updated", summary: `Payroll settings saved (deductions: ${on})` });
  return { settings: await getSettings(companyId) };
}

// ---- Paid days ----

interface MonthFacts {
  cal: WorkCalendar;
  start: string;
  end: string;
  totalDays: number;
  today: string;
  dayOffHolidays: Set<string>;
  tracksAttendance: boolean; // Attendance module off = no check-ins to judge LOP by
}

interface Person {
  id: number;
  join_date: string | null; // falls back to when they were added
  exit_date: string | null;
  status: string;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

// Paid days = employed days − LOP (working days with no check-in and no approved leave)
async function paidDaysFor(companyId: number, person: Person, m: MonthFacts) {
  const first = person.join_date && person.join_date > m.start ? person.join_date : m.start;
  const leaving = person.status !== "active" && person.exit_date;
  const last = leaving && person.exit_date! < m.end ? person.exit_date! : m.end;
  if (first > last) return { paidDays: 0, lopDays: 0 };
  // No attendance tracking: every employed day is paid
  if (!m.tracksAttendance) return { paidDays: daysBetween(first, last), lopDays: 0 };

  const [days, leaves] = await Promise.all([
    db
      .select({ date: attendance.date, status: attendance.status, punch_in: attendance.punch_in })
      .from(attendance)
      .where(and(eq(attendance.company_id, companyId), eq(attendance.employee_id, person.id), between(attendance.date, first, last))),
    db
      .select({ from: leaveRequests.from_date, to: leaveRequests.to_date, half: leaveRequests.half_day })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.company_id, companyId),
          eq(leaveRequests.employee_id, person.id),
          eq(leaveRequests.status, "approved"),
          lte(leaveRequests.from_date, last),
          gte(leaveRequests.to_date, first),
        ),
      ),
  ]);
  const worked = new Map<string, number>();
  for (const d of days) worked.set(d.date, d.punch_in || d.status === "present" ? 1 : d.status === "half" ? 0.5 : 0);

  let paid = 0;
  let lop = 0;
  for (let d = new Date(`${first}T00:00:00Z`); iso(d) <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = iso(d);
    if (day > m.today || m.cal.isWeeklyOff(day) || m.dayOffHolidays.has(day)) {
      paid += 1;
      continue;
    }
    const onLeave = leaves.filter((l) => l.from <= day && l.to >= day).reduce((s, l) => s + (l.half ? 0.5 : 1), 0);
    const got = Math.min(1, (worked.get(day) ?? 0) + onLeave);
    paid += got;
    lop += 1 - got;
  }
  return { paidDays: paid, lopDays: lop };
}

// ---- Runs: draft → (recalculate) → finalized ----

const runSelect = {
  ...getTableColumns(payrollRuns),
  finalized_by_name: users.name,
  employee_count: sql<number>`(select count(*)::int from ${payslips} p where p.payroll_run_id = ${payrollRuns.id})`,
  total_gross: sql<string>`(select coalesce(sum(p.gross), 0) from ${payslips} p where p.payroll_run_id = ${payrollRuns.id})`,
  total_net: sql<string>`(select coalesce(sum(p.net_pay), 0) from ${payslips} p where p.payroll_run_id = ${payrollRuns.id})`,
};

async function getRun(companyId: number, id: number) {
  const [run] = await db
    .select(runSelect)
    .from(payrollRuns)
    .leftJoin(users, eq(users.id, payrollRuns.finalized_by))
    .where(and(eq(payrollRuns.company_id, companyId), eq(payrollRuns.id, id)));
  if (!run) throw new NotFoundError("Payroll run not found");
  return run;
}

// Work out every payslip of a draft run (replaces any earlier ones)
async function computeRun(companyId: number, runId: number, month: number, year: number) {
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${totalDays}`;

  const [structures, settings, cal, holidayRows] = await Promise.all([
    structuresAsOf(companyId, end),
    getSettings(companyId),
    workCalendar(companyId),
    db
      .select({ date: holidays.date })
      .from(holidays)
      .where(and(eq(holidays.company_id, companyId), eq(holidays.is_optional, false), between(holidays.date, start, end))),
  ]);
  if (!structures.length) throw new BadRequestError(`Nobody has a salary structure in effect by the end of ${monthName(month, year)}`);

  const people = await db
    .select({
      id: employees.id,
      join_date: sql<string>`coalesce(${employees.join_date}::text, (${employees.created_at} at time zone 'Asia/Kolkata')::date::text)`,
      exit_date: employees.exit_date,
      status: employees.status,
    })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), inArray(employees.id, structures.map((s) => s.employee_id))));
  const byId = new Map(people.map((p) => [p.id, p]));
  const m: MonthFacts = {
    cal,
    start,
    end,
    totalDays,
    today: localDate(),
    dayOffHolidays: new Set(holidayRows.map((h) => h.date)),
    tracksAttendance: !(await disabledModules(companyId)).has("attendance"),
  };
  const deductions: Deductions = { pf: settings.pfEnabled, esi: settings.esiEnabled, pt: settings.ptEnabled, tds: settings.tdsEnabled, pfCeiling: settings.pfCeiling };

  // One-time items, HR's LOP numbers and loans being recovered this month
  const monthKey = `${year}-${mm}`;
  const [adjustments, overrides, loans] = await Promise.all([
    db.select().from(payrollAdjustments).where(eq(payrollAdjustments.payroll_run_id, runId)),
    db.select().from(payrollLopOverrides).where(eq(payrollLopOverrides.payroll_run_id, runId)),
    db
      .select()
      .from(employeeLoans)
      .where(and(eq(employeeLoans.company_id, companyId), eq(employeeLoans.status, "active"), lte(employeeLoans.start_month, monthKey))),
  ]);
  const lopOf = new Map(overrides.map((o) => [o.employee_id, Number(o.lop_days)]));

  const rows: (typeof payslips.$inferInsert)[] = [];
  for (const s of structures) {
    const person = byId.get(s.employee_id);
    if (!person) continue;
    if (person.join_date && person.join_date > end) continue; // joins later
    if (person.status === "exited" && person.exit_date && person.exit_date < start) continue; // already gone
    const counted = await paidDaysFor(companyId, person, m);
    // HR's LOP number wins over attendance
    const override = lopOf.get(s.employee_id);
    const lopDays = override ?? counted.lopDays;
    const paidDays = override != null ? Math.max(0, counted.paidDays + counted.lopDays - override) : counted.paidDays;

    const mine = adjustments.filter((a) => a.employee_id === s.employee_id);
    const line = (a: (typeof adjustments)[number]): Adjustment => ({ category: a.category, label: a.label, amount: Number(a.amount) });
    const loanLines: Adjustment[] = loans
      .filter((l) => l.employee_id === s.employee_id)
      .map((l) => ({
        category: l.kind === "loan" ? "loan_emi" : "advance_recovery",
        label: l.kind === "loan" ? "Loan EMI" : "Salary advance recovery",
        amount: Math.min(Number(l.emi), Number(l.principal) - Number(l.recovered)),
        loanId: l.id,
      }))
      .filter((l) => l.amount > 0);

    const calc = calculatePayslip({
      basic: Number(s.basic),
      hra: Number(s.hra),
      allowances: Number(s.allowances),
      components: s.components,
      paidDays,
      totalDays,
      deductions,
      earnings: mine.filter((a) => a.kind === "earning" && a.category !== "reimbursement").map(line),
      reimbursements: mine.filter((a) => a.category === "reimbursement").map(line),
      otherDeductions: [...mine.filter((a) => a.kind === "deduction").map(line), ...loanLines],
    });
    rows.push({
      company_id: companyId,
      payroll_run_id: runId,
      employee_id: s.employee_id,
      basic: String(calc.basic),
      hra: String(calc.hra),
      allowances: String(calc.allowances),
      gross: String(calc.gross),
      paid_days: String(paidDays),
      lop_days: String(lopDays),
      total_days: totalDays,
      pf_employee: String(calc.pfEmployee),
      pf_employer: String(calc.pfEmployer),
      esi_employee: String(calc.esiEmployee),
      esi_employer: String(calc.esiEmployer),
      professional_tax: String(calc.professionalTax),
      tds: String(calc.tds),
      total_deductions: String(calc.totalDeductions),
      net_pay: String(calc.netPay),
      earnings: calc.earningLines,
      additions: String(calc.additions),
      addition_lines: calc.additionLines,
      reimbursements: String(calc.reimbursements),
      other_deductions: String(calc.otherDeductions),
      deduction_lines: calc.deductionLines,
    });
  }
  await db.transaction(async (tx) => {
    await tx.delete(payslips).where(eq(payslips.payroll_run_id, runId));
    if (rows.length) await tx.insert(payslips).values(rows);
    await tx.update(payrollRuns).set({ run_at: new Date() }).where(eq(payrollRuns.id, runId));
  });
}

// POST /api/payroll/run — creates a draft for the month
export async function runPayroll(companyId: number, actor: Express.AuthUser, { month, year }: RunPayrollInput) {
  const mm = String(month).padStart(2, "0");
  if (`${year}-${mm}-01` > localDate()) throw new BadRequestError("That month hasn't started yet");
  const [existing] = await db
    .select({ id: payrollRuns.id, status: payrollRuns.status })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.company_id, companyId), eq(payrollRuns.month, month), eq(payrollRuns.year, year)));
  if (existing) throw new ConflictError(`Payroll for ${monthName(month, year)} already exists (${existing.status}) — ${existing.status === "draft" ? "recalculate it" : "it's finalized"}`);

  const [run] = await db.insert(payrollRuns).values({ company_id: companyId, month, year, status: "draft" }).returning({ id: payrollRuns.id });
  try {
    await computeRun(companyId, run.id, month, year);
  } catch (err) {
    await db.delete(payrollRuns).where(eq(payrollRuns.id, run.id)); // nothing to keep
    throw err;
  }
  audit(actor, { companyId, action: "payroll.run", target: ["payroll_run", run.id], summary: `Ran payroll for ${monthName(month, year)} (draft)` });
  return { run: await getRun(companyId, run.id) };
}

async function getDraft(companyId: number, id: number) {
  const run = await getRun(companyId, id);
  if (run.status !== "draft") throw new BadRequestError(`${monthName(run.month, run.year)} is finalized and can't be changed`);
  return run;
}

export async function recalculateRun(companyId: number, actor: Express.AuthUser, id: number) {
  const run = await getDraft(companyId, id);
  await computeRun(companyId, id, run.month, run.year);
  audit(actor, { companyId, action: "payroll.recalculated", target: ["payroll_run", id], summary: `Recalculated payroll for ${monthName(run.month, run.year)}` });
  return { run: await getRun(companyId, id) };
}

export async function deleteRun(companyId: number, actor: Express.AuthUser, id: number) {
  const run = await getDraft(companyId, id);
  await db.delete(payrollRuns).where(eq(payrollRuns.id, id));
  audit(actor, { companyId, action: "payroll.deleted", target: ["payroll_run", id], summary: `Deleted the draft payroll for ${monthName(run.month, run.year)}` });
}

// Locks the run; employees can now see their payslips and are told so
export async function finalizeRun(companyId: number, actor: Express.AuthUser, id: number) {
  const run = await getDraft(companyId, id);
  if (!run.employee_count) throw new BadRequestError("This run has no payslips");
  await db.transaction(async (tx) => {
    await tx.update(payrollRuns).set({ status: "finalized", finalized_at: new Date(), finalized_by: actor.id }).where(eq(payrollRuns.id, id));
    // EMIs taken in this payroll reduce what's left on each loan; a fully paid loan closes
    const slipLines = await tx.select({ lines: payslips.deduction_lines }).from(payslips).where(eq(payslips.payroll_run_id, id));
    const taken = new Map<number, number>();
    for (const s of slipLines) for (const l of s.lines) if (l.loanId) taken.set(l.loanId, (taken.get(l.loanId) ?? 0) + l.amount);
    for (const [loanId, amount] of taken) {
      await tx.insert(loanRecoveries).values({ company_id: companyId, loan_id: loanId, payroll_run_id: id, amount: String(amount) }).onConflictDoNothing();
      await tx
        .update(employeeLoans)
        .set({
          recovered: sql`${employeeLoans.recovered} + ${amount}`,
          status: sql`case when ${employeeLoans.recovered} + ${amount} >= ${employeeLoans.principal} then 'closed' else ${employeeLoans.status} end`,
          closed_at: sql`case when ${employeeLoans.recovered} + ${amount} >= ${employeeLoans.principal} then now() else null end`,
        })
        .where(eq(employeeLoans.id, loanId));
    }
  });
  audit(actor, { companyId, action: "payroll.finalized", target: ["payroll_run", id], summary: `Finalized payroll for ${monthName(run.month, run.year)} — ${run.employee_count} payslips` });

  const slips = await db.select({ id: payslips.id, employee_id: payslips.employee_id, net_pay: payslips.net_pay }).from(payslips).where(eq(payslips.payroll_run_id, id));
  const period = monthName(run.month, run.year);
  for (const s of slips) {
    void notify({
      companyId,
      to: [{ employeeId: s.employee_id }],
      type: "payslip.ready",
      title: `Your payslip for ${period} is ready`,
      body: `Net pay ₹${Number(s.net_pay).toLocaleString("en-IN")}`,
      link: "/my-payslips",
      entity: ["payslip", s.id],
      actorId: actor.id,
      email: (r) => ({ template: "payslipReady", props: { name: r.name, period, netPay: Number(s.net_pay) } }),
    });
  }
  return { run: await getRun(companyId, id) };
}

export async function listRuns(companyId: number) {
  const runs = await db
    .select(runSelect)
    .from(payrollRuns)
    .leftJoin(users, eq(users.id, payrollRuns.finalized_by))
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

// ---- Payslips: PDF, and an employee's own ----

// One payslip with everything the PDF prints (employeeId = only theirs, finalized)
export async function getPayslipForPdf(companyId: number, id: number, employeeId?: number) {
  const [payslip] = await db
    .select({
      ...getTableColumns(payslips),
      employee_name: employees.name,
      employee_code: employees.employee_code,
      designation: designations.name,
      department: departments.name,
      company_name: companies.name,
      month: payrollRuns.month,
      year: payrollRuns.year,
      run_status: payrollRuns.status,
    })
    .from(payslips)
    .innerJoin(employees, eq(employees.id, payslips.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .leftJoin(departments, eq(departments.id, employees.department_id))
    .innerJoin(companies, eq(companies.id, payslips.company_id))
    .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payroll_run_id))
    .where(and(eq(payslips.company_id, companyId), eq(payslips.id, id)));
  if (!payslip || (employeeId && (payslip.employee_id !== employeeId || payslip.run_status !== "finalized"))) throw new NotFoundError("Payslip not found");
  return payslip;
}

// GET /api/me/payslips — my finalized payslips, newest first
export async function myPayslips(companyId: number, employeeId: number) {
  const rows = await db
    .select({
      id: payslips.id,
      month: payrollRuns.month,
      year: payrollRuns.year,
      gross: payslips.gross,
      total_deductions: payslips.total_deductions,
      net_pay: payslips.net_pay,
      paid_days: payslips.paid_days,
      lop_days: payslips.lop_days,
      total_days: payslips.total_days,
      basic: payslips.basic,
      hra: payslips.hra,
      allowances: payslips.allowances,
      pf_employee: payslips.pf_employee,
      esi_employee: payslips.esi_employee,
      professional_tax: payslips.professional_tax,
      tds: payslips.tds,
      earnings: payslips.earnings,
      addition_lines: payslips.addition_lines,
      deduction_lines: payslips.deduction_lines,
      additions: payslips.additions,
      reimbursements: payslips.reimbursements,
      other_deductions: payslips.other_deductions,
    })
    .from(payslips)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payroll_run_id))
    .where(and(eq(payslips.company_id, companyId), eq(payslips.employee_id, employeeId), eq(payrollRuns.status, "finalized")))
    .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
  return { payslips: rows };
}

// ---- One-time items and LOP for a draft run (each change recalculates the run) ----

export async function listAdjustments(companyId: number, runId: number) {
  await getRun(companyId, runId);
  const rows = await db
    .select({ ...getTableColumns(payrollAdjustments), employee_name: employees.name, created_by_name: users.name })
    .from(payrollAdjustments)
    .innerJoin(employees, eq(employees.id, payrollAdjustments.employee_id))
    .leftJoin(users, eq(users.id, payrollAdjustments.created_by))
    .where(and(eq(payrollAdjustments.company_id, companyId), eq(payrollAdjustments.payroll_run_id, runId)))
    .orderBy(asc(employees.name), asc(payrollAdjustments.id));
  const lop = await db
    .select({ employee_id: payrollLopOverrides.employee_id, lop_days: payrollLopOverrides.lop_days, note: payrollLopOverrides.note, employee_name: employees.name })
    .from(payrollLopOverrides)
    .innerJoin(employees, eq(employees.id, payrollLopOverrides.employee_id))
    .where(eq(payrollLopOverrides.payroll_run_id, runId));
  return { adjustments: rows, lopOverrides: lop };
}

const DEDUCTION_CATEGORIES = new Set(["advance_recovery", "fine", "other_deduction"]);

export async function addAdjustment(companyId: number, actor: Express.AuthUser, runId: number, input: AdjustmentInput) {
  const run = await getDraft(companyId, runId);
  const e = await getEmployeeById(companyId, input.employeeId);
  const kind = DEDUCTION_CATEGORIES.has(input.category) ? "deduction" : "earning";
  await db.insert(payrollAdjustments).values({
    company_id: companyId,
    payroll_run_id: runId,
    employee_id: e.id,
    kind,
    category: input.category,
    label: input.label,
    amount: String(input.amount),
    created_by: actor.id,
  });
  await computeRun(companyId, runId, run.month, run.year);
  audit(actor, { companyId, action: "payroll.adjustment", target: ["payroll_run", runId], summary: `${kind === "earning" ? "Added" : "Deducted"} ₹${input.amount.toLocaleString("en-IN")} (${input.label}) for ${e.name} in ${monthName(run.month, run.year)}` });
  return { run: await getRun(companyId, runId), ...(await listAdjustments(companyId, runId)) };
}

export async function removeAdjustment(companyId: number, actor: Express.AuthUser, runId: number, adjustmentId: number) {
  const run = await getDraft(companyId, runId);
  const [row] = await db
    .delete(payrollAdjustments)
    .where(and(eq(payrollAdjustments.company_id, companyId), eq(payrollAdjustments.payroll_run_id, runId), eq(payrollAdjustments.id, adjustmentId)))
    .returning({ label: payrollAdjustments.label });
  if (!row) throw new NotFoundError("Item not found");
  await computeRun(companyId, runId, run.month, run.year);
  audit(actor, { companyId, action: "payroll.adjustment", target: ["payroll_run", runId], summary: `Removed "${row.label}" from ${monthName(run.month, run.year)}` });
  return { run: await getRun(companyId, runId), ...(await listAdjustments(companyId, runId)) };
}

export async function setLop(companyId: number, actor: Express.AuthUser, runId: number, input: LopInput) {
  const run = await getDraft(companyId, runId);
  const e = await getEmployeeById(companyId, input.employeeId);
  const totalDays = new Date(Date.UTC(run.year, run.month, 0)).getUTCDate();
  if (input.lopDays != null && input.lopDays > totalDays) throw new BadRequestError(`LOP can't be more than ${totalDays} days`);
  if (input.lopDays == null) {
    await db.delete(payrollLopOverrides).where(and(eq(payrollLopOverrides.payroll_run_id, runId), eq(payrollLopOverrides.employee_id, e.id)));
  } else {
    await db
      .insert(payrollLopOverrides)
      .values({ payroll_run_id: runId, employee_id: e.id, lop_days: String(input.lopDays), note: input.note ?? null })
      .onConflictDoUpdate({ target: [payrollLopOverrides.payroll_run_id, payrollLopOverrides.employee_id], set: { lop_days: String(input.lopDays), note: input.note ?? null } });
  }
  await computeRun(companyId, runId, run.month, run.year);
  audit(actor, {
    companyId,
    action: "payroll.lop",
    target: ["payroll_run", runId],
    summary: input.lopDays == null ? `LOP of ${e.name} back to attendance in ${monthName(run.month, run.year)}` : `Set LOP of ${e.name} to ${input.lopDays} days in ${monthName(run.month, run.year)}`,
  });
  return { run: await getRun(companyId, runId), ...(await listAdjustments(companyId, runId)) };
}

// ---- Loans and salary advances ----

const loanRow = {
  ...getTableColumns(employeeLoans),
  employee_name: employees.name,
  employee_code: employees.employee_code,
  balance: sql<string>`(${employeeLoans.principal} - ${employeeLoans.recovered})::text`,
};

export async function listLoans(companyId: number, status?: string) {
  const rows = await db
    .select(loanRow)
    .from(employeeLoans)
    .innerJoin(employees, eq(employees.id, employeeLoans.employee_id))
    .where(and(eq(employeeLoans.company_id, companyId), status && status !== "all" ? eq(employeeLoans.status, status as "active") : undefined))
    .orderBy(desc(employeeLoans.created_at));
  const [totals] = await db
    .select({
      active: sql<number>`count(*) filter (where ${employeeLoans.status} = 'active')::int`,
      outstanding: sql<string>`coalesce(sum(${employeeLoans.principal} - ${employeeLoans.recovered}) filter (where ${employeeLoans.status} = 'active'), 0)::text`,
      monthlyEmi: sql<string>`coalesce(sum(${employeeLoans.emi}) filter (where ${employeeLoans.status} = 'active'), 0)::text`,
    })
    .from(employeeLoans)
    .where(eq(employeeLoans.company_id, companyId));
  return { loans: rows, totals };
}

export async function createLoan(companyId: number, actor: Express.AuthUser, input: LoanInput, source?: { type: string; id: number }) {
  const e = await getEmployeeById(companyId, input.employeeId);
  if (e.status === "exited") throw new BadRequestError(`${e.name} has left the company`);
  if (input.emi > input.principal) throw new BadRequestError("EMI can't be more than the amount");
  const [loan] = await db
    .insert(employeeLoans)
    .values({
      company_id: companyId,
      employee_id: e.id,
      kind: input.kind,
      principal: String(input.principal),
      emi: String(input.emi),
      start_month: input.startMonth,
      reason: input.reason ?? null,
      source_type: source?.type ?? null,
      source_id: source?.id ?? null,
      created_by: actor.id,
    })
    .returning();
  audit(actor, { companyId, action: "payroll.loan", target: ["employee", e.id], summary: `${input.kind === "loan" ? "Loan" : "Salary advance"} of ₹${input.principal.toLocaleString("en-IN")} for ${e.name}, ₹${input.emi.toLocaleString("en-IN")}/month from ${input.startMonth}` });
  return { loan };
}

export async function updateLoan(companyId: number, actor: Express.AuthUser, id: number, input: LoanUpdateInput) {
  const [loan] = await db
    .select(loanRow)
    .from(employeeLoans)
    .innerJoin(employees, eq(employees.id, employeeLoans.employee_id))
    .where(and(eq(employeeLoans.company_id, companyId), eq(employeeLoans.id, id)));
  if (!loan) throw new NotFoundError("Loan not found");
  if (loan.status !== "active") throw new BadRequestError("This loan is already closed");
  const set: Partial<typeof employeeLoans.$inferInsert> = {};
  if (input.emi !== undefined) set.emi = String(input.emi);
  if (input.startMonth) set.start_month = input.startMonth;
  if (input.status) {
    set.status = input.status;
    set.closed_at = new Date();
  }
  await db.update(employeeLoans).set(set).where(eq(employeeLoans.id, id));
  audit(actor, {
    companyId,
    action: "payroll.loan",
    target: ["employee", loan.employee_id],
    summary: input.status ? `${input.status === "closed" ? "Closed" : "Cancelled"} the loan of ${loan.employee_name} (₹${Number(loan.balance).toLocaleString("en-IN")} left)` : `Changed the loan of ${loan.employee_name}`,
  });
  return listLoans(companyId);
}

export async function loanRecoveryHistory(companyId: number, id: number) {
  const rows = await db
    .select({ id: loanRecoveries.id, amount: loanRecoveries.amount, month: payrollRuns.month, year: payrollRuns.year, created_at: loanRecoveries.created_at })
    .from(loanRecoveries)
    .innerJoin(payrollRuns, eq(payrollRuns.id, loanRecoveries.payroll_run_id))
    .where(and(eq(loanRecoveries.company_id, companyId), eq(loanRecoveries.loan_id, id)))
    .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
  return { recoveries: rows };
}

// Totals for the run screen: what the company pays out and owes the government
export async function runSummary(companyId: number, runId: number) {
  const run = await getRun(companyId, runId);
  const [t] = await db
    .select({
      gross: sql<string>`coalesce(sum(${payslips.gross}), 0)::text`,
      net: sql<string>`coalesce(sum(${payslips.net_pay}), 0)::text`,
      additions: sql<string>`coalesce(sum(${payslips.additions}), 0)::text`,
      reimbursements: sql<string>`coalesce(sum(${payslips.reimbursements}), 0)::text`,
      pfEmployee: sql<string>`coalesce(sum(${payslips.pf_employee}), 0)::text`,
      pfEmployer: sql<string>`coalesce(sum(${payslips.pf_employer}), 0)::text`,
      esiEmployee: sql<string>`coalesce(sum(${payslips.esi_employee}), 0)::text`,
      esiEmployer: sql<string>`coalesce(sum(${payslips.esi_employer}), 0)::text`,
      pt: sql<string>`coalesce(sum(${payslips.professional_tax}), 0)::text`,
      tds: sql<string>`coalesce(sum(${payslips.tds}), 0)::text`,
      otherDeductions: sql<string>`coalesce(sum(${payslips.other_deductions}), 0)::text`,
      lopDays: sql<string>`coalesce(sum(${payslips.lop_days}), 0)::text`,
    })
    .from(payslips)
    .where(eq(payslips.payroll_run_id, runId));
  const n = (v: string) => Number(v);
  return {
    run,
    totals: {
      ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, n(v)])),
      // Salary cost to the company = gross + employer PF + employer ESI + reimbursements
      employerCost: n(t.gross) + n(t.pfEmployer) + n(t.esiEmployer) + n(t.reimbursements),
    },
  };
}
