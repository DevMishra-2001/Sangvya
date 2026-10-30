import { and, asc, between, desc, eq, getTableColumns, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  attendance,
  companies,
  departments,
  designations,
  employees,
  holidays,
  leaveRequests,
  payrollRuns,
  payrollSettings,
  payslips,
  salaryStructures,
  users,
} from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { calculatePayslip, type Deductions } from "../../utils/payrollCalculations.js";
import { localDate } from "../../utils/workday.js";
import { workCalendar, type WorkCalendar } from "../companies/workCalendar.js";
import { getEmployeeById } from "../employees/employees.service.js";
import { notify } from "../notifications/notify.js";
import type { PayrollSettingsInput, RunPayrollInput, SalaryStructureInput } from "./payroll.schema.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m: number, y: number) => `${MONTH_NAMES[m - 1]} ${y}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---- Salary structures ----

// A new row per revision — effective_from keeps the history
export async function setSalaryStructure(companyId: number, input: SalaryStructureInput) {
  await getEmployeeById(companyId, input.employeeId);
  const [structure] = await db
    .insert(salaryStructures)
    .values({
      company_id: companyId,
      employee_id: input.employeeId,
      basic: String(input.basic),
      hra: String(input.hra ?? 0),
      allowances: String(input.allowances ?? 0),
      ...(input.effectiveFrom ? { effective_from: input.effectiveFrom } : {}),
    })
    .returning();
  return { structure };
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

export async function getSettings(companyId: number) {
  const [row] = await db
    .insert(payrollSettings)
    .values({ company_id: companyId })
    .onConflictDoUpdate({ target: payrollSettings.company_id, set: { company_id: sql`excluded.company_id` } })
    .returning();
  return { pfEnabled: row.pf_enabled, esiEnabled: row.esi_enabled, ptEnabled: row.pt_enabled, tdsEnabled: row.tds_enabled };
}

export async function updateSettings(companyId: number, actor: Express.AuthUser, input: PayrollSettingsInput) {
  await getSettings(companyId);
  await db
    .update(payrollSettings)
    .set({ pf_enabled: input.pfEnabled, esi_enabled: input.esiEnabled, pt_enabled: input.ptEnabled, tds_enabled: input.tdsEnabled, updated_at: sql`now()` })
    .where(eq(payrollSettings.company_id, companyId));
  const on = [input.pfEnabled && "PF", input.esiEnabled && "ESI", input.ptEnabled && "PT", input.tdsEnabled && "TDS"].filter(Boolean).join(", ") || "none";
  audit(actor, { companyId, action: "payroll.settings_updated", summary: `Payroll deductions set to: ${on}` });
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
}

interface Person {
  id: number;
  join_date: string | null; // falls back to when they were added
  exit_date: string | null;
  status: string;
}

// Paid days = employed days − LOP (working days with no check-in and no approved leave)
async function paidDaysFor(companyId: number, person: Person, m: MonthFacts) {
  const first = person.join_date && person.join_date > m.start ? person.join_date : m.start;
  const leaving = person.status !== "active" && person.exit_date;
  const last = leaving && person.exit_date! < m.end ? person.exit_date! : m.end;
  if (first > last) return { paidDays: 0, lopDays: 0 };

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
  const m: MonthFacts = { cal, start, end, totalDays, today: localDate(), dayOffHolidays: new Set(holidayRows.map((h) => h.date)) };
  const deductions: Deductions = { pf: settings.pfEnabled, esi: settings.esiEnabled, pt: settings.ptEnabled, tds: settings.tdsEnabled };

  const rows: (typeof payslips.$inferInsert)[] = [];
  for (const s of structures) {
    const person = byId.get(s.employee_id);
    if (!person) continue;
    if (person.join_date && person.join_date > end) continue; // joins later
    if (person.status === "exited" && person.exit_date && person.exit_date < start) continue; // already gone
    const { paidDays, lopDays } = await paidDaysFor(companyId, person, m);
    const calc = calculatePayslip({ basic: Number(s.basic), hra: Number(s.hra), allowances: Number(s.allowances), paidDays, totalDays, deductions });
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
  await db.update(payrollRuns).set({ status: "finalized", finalized_at: new Date(), finalized_by: actor.id }).where(eq(payrollRuns.id, id));
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
    })
    .from(payslips)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payroll_run_id))
    .where(and(eq(payslips.company_id, companyId), eq(payslips.employee_id, employeeId), eq(payrollRuns.status, "finalized")))
    .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
  return { payslips: rows };
}
