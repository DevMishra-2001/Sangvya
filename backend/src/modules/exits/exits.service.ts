// Exit management: everyone leaving, their clearance, full & final settlement and exit interview
import { and, asc, count, desc, eq, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../config/db.js";
import { departments, designations, employeeExits, employees, exitClearances, payrollRuns, payslips, salaryStructures } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import { offsetOf, pageMeta } from "../../utils/pagination.js";
import { localDate } from "../../utils/workday.js";
import { openAssetsOf } from "../assets/assets.service.js";
import { getEmployeeById } from "../employees/employees.service.js";
import { BALANCE_TYPES, getBalances } from "../leaves/leaveBalance.service.js";
import { ensureExitRecord } from "./exitRecord.js";
import type { clearanceSchema, interviewSchema, listQuery, settlementSchema } from "./exits.schema.js";

const openAssets = sql<number>`(select count(*)::int from asset_assignments a where a.employee_id = ${employees.id} and a.returned_on is null)`;
const pendingItems = sql<number>`(select count(*)::int from exit_clearances c where c.employee_id = ${employees.id} and not c.done)`;
const totalItems = sql<number>`(select count(*)::int from exit_clearances c where c.employee_id = ${employees.id})`;
// notice → clearance → settlement → completed (people who left before this module = completed)
const stage = sql<"notice" | "clearance" | "settlement" | "completed">`(case
  when ${employeeExits.completed_at} is not null or (${employeeExits.employee_id} is null and ${employees.status} = 'exited') then 'completed'
  when ${employees.status} = 'notice' then 'notice'
  when ${pendingItems} > 0 or ${openAssets} > 0 then 'clearance'
  else 'settlement' end)`;
const net = sql<string>`(coalesce(${employeeExits.last_salary},0) + coalesce(${employeeExits.leave_encashment},0) + coalesce(${employeeExits.bonus},0) - coalesce(${employeeExits.notice_recovery},0) - coalesce(${employeeExits.other_deductions},0))::text`;

const row = {
  id: employees.id,
  name: employees.name,
  photo_url: employees.photo_url,
  employee_code: employees.employee_code,
  designation: designations.name,
  department: departments.name,
  join_date: employees.join_date,
  status: employees.status,
  exit_date: employees.exit_date,
  exit_reason: employees.exit_reason,
  exit_notes: employees.exit_notes,
  salary: employees.salary,
  started_on: employeeExits.started_on,
  stage,
  open_assets: openAssets,
  pending_items: pendingItems,
  total_items: totalItems,
  settlement_status: employeeExits.settlement_status,
  net_payable: net,
};

const base = () =>
  db
    .select(row)
    .from(employees)
    .leftJoin(employeeExits, eq(employeeExits.employee_id, employees.id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .leftJoin(departments, eq(departments.id, employees.department_id));

const leaving = (companyId: number) => and(eq(employees.company_id, companyId), inArray(employees.status, ["notice", "exited"]));

export async function listExits(companyId: number, q: z.infer<typeof listQuery>) {
  const filters = [leaving(companyId)!];
  if (q.stage === "open") filters.push(sql`${stage} <> 'completed'`);
  else if (q.stage !== "all") filters.push(sql`${stage} = ${q.stage}`);
  if (q.search) {
    const like = `%${q.search.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(or(ilike(employees.name, like), ilike(employees.employee_code, like))!);
  }
  const where = and(...filters);
  const month = `${localDate().slice(0, 7)}-01`;
  const [rows, [{ n }], [stats]] = await Promise.all([
    base().where(where).orderBy(asc(sql`case ${stage} when 'notice' then 1 when 'clearance' then 2 when 'settlement' then 3 else 4 end`), asc(employees.exit_date)).limit(q.limit).offset(offsetOf(q.page, q.limit)),
    db.select({ n: count() }).from(employees).leftJoin(employeeExits, eq(employeeExits.employee_id, employees.id)).where(where),
    db
      .select({
        notice: sql<number>`count(*) filter (where ${stage} = 'notice')::int`,
        clearance: sql<number>`count(*) filter (where ${stage} = 'clearance')::int`,
        settlement: sql<number>`count(*) filter (where ${stage} = 'settlement')::int`,
        completedThisMonth: sql<number>`count(*) filter (where ${stage} = 'completed' and ${employees.exit_date} >= ${month})::int`,
        avgNoticeDays: sql<number>`coalesce(round(avg(greatest(${employees.exit_date} - ${employeeExits.started_on}, 0)) filter (where ${employeeExits.started_on} is not null)), 0)::int`,
      })
      .from(employees)
      .leftJoin(employeeExits, eq(employeeExits.employee_id, employees.id))
      .where(leaving(companyId)),
  ]);
  return { exits: rows, stats, ...pageMeta(q.page, q.limit, n) };
}

async function findExit(companyId: number, id: number) {
  const [e] = await base().where(and(leaving(companyId), eq(employees.id, id)));
  if (!e) throw new NotFoundError("No exit for this employee");
  return e;
}

// One exit: everything for the side panel (an older exit gets its record on first open)
export async function exitDetail(companyId: number, id: number) {
  await findExit(companyId, id);
  await ensureExitRecord(companyId, id);
  const [exit, [record], items, assets] = await Promise.all([
    findExit(companyId, id),
    db.select().from(employeeExits).where(eq(employeeExits.employee_id, id)),
    db
      .select({ key: exitClearances.item_key, label: exitClearances.label, done: exitClearances.done, done_at: exitClearances.done_at, notes: exitClearances.notes, by: sql<string | null>`(select u.name from users u where u.id = ${exitClearances.done_by})` })
      .from(exitClearances)
      .where(eq(exitClearances.employee_id, id))
      .orderBy(asc(exitClearances.id)),
    openAssetsOf(companyId, id),
  ]);
  return { exit, record, clearance: items, openAssets: assets };
}

export async function setClearance(companyId: number, actor: Express.AuthUser, id: number, key: string, input: z.infer<typeof clearanceSchema>) {
  const e = await findExit(companyId, id);
  await ensureExitRecord(companyId, id);
  const [item] = await db
    .update(exitClearances)
    .set({ done: input.done, notes: input.notes ?? null, done_by: input.done ? actor.id : null, done_at: input.done ? new Date() : null })
    .where(and(eq(exitClearances.company_id, companyId), eq(exitClearances.employee_id, id), eq(exitClearances.item_key, key)))
    .returning({ label: exitClearances.label });
  if (!item) throw new NotFoundError("Checklist item not found");
  audit(actor, { companyId, action: "exit.clearance", target: ["employee", id], summary: `${input.done ? "Cleared" : "Re-opened"} "${item.label}" for ${e.name}` });
  return exitDetail(companyId, id);
}

const money = (v: number | null | undefined) => (v == null ? null : String(v));

export async function saveSettlement(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof settlementSchema>) {
  const e = await findExit(companyId, id);
  await ensureExitRecord(companyId, id);
  if (input.status === "paid") {
    if (e.status !== "exited") throw new BadRequestError(`${e.name} is still serving notice — settle after the last working day`);
    if (e.pending_items > 0 || e.open_assets > 0) throw new BadRequestError("Finish the clearance (and get assets back) before marking it paid");
  }
  await db
    .update(employeeExits)
    .set({
      last_salary: money(input.lastSalary),
      leave_encashment: money(input.leaveEncashment),
      bonus: money(input.bonus),
      notice_recovery: money(input.noticeRecovery),
      other_deductions: money(input.otherDeductions),
      settlement_notes: input.notes ?? null,
      settlement_status: input.status,
      settled_on: input.status === "paid" ? (input.settledOn ?? localDate()) : null,
    })
    .where(eq(employeeExits.employee_id, id));
  audit(actor, { companyId, action: "exit.settlement", target: ["employee", id], summary: `Full & final for ${e.name}: ${input.status}` });
  return exitDetail(companyId, id);
}

const LEAVE_LABELS: Record<(typeof BALANCE_TYPES)[number], string> = { cl: "Casual leave", sl: "Sick leave", ol: "Optional leave", el: "Earned leave", comp_off: "Comp off" };
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const round = (n: number) => Math.round(n * 100) / 100;

// F&F suggestion: salary still owed (unpaid months + days of the last month), leave balance to encash, notice served.
// HR picks what to encash / how much notice was due on screen; nothing is saved here.
export async function settlementEstimate(companyId: number, id: number) {
  const e = await findExit(companyId, id);
  if (!e.exit_date) throw new BadRequestError("Set the last working day first");
  const exitDate = e.exit_date;
  const [structure] = await db
    .select({ basic: salaryStructures.basic, hra: salaryStructures.hra, allowances: salaryStructures.allowances })
    .from(salaryStructures)
    .where(and(eq(salaryStructures.company_id, companyId), eq(salaryStructures.employee_id, id), lte(salaryStructures.effective_from, exitDate)))
    .orderBy(desc(salaryStructures.effective_from))
    .limit(1);
  const monthly = structure ? Number(structure.basic) + Number(structure.hra) + Number(structure.allowances) : Number(e.salary ?? 0);
  const source = structure ? "structure" : e.salary ? "employee" : null;

  // Last month someone was paid for, from finalized or draft payroll runs
  const [lastPaid] = await db
    .select({ year: payrollRuns.year, month: payrollRuns.month })
    .from(payslips)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payslips.payroll_run_id))
    .where(and(eq(payslips.company_id, companyId), eq(payslips.employee_id, id)))
    .orderBy(desc(payrollRuns.year), desc(payrollRuns.month))
    .limit(1);

  const [ey, em, ed] = exitDate.split("-").map(Number);
  const joined = e.join_date ?? exitDate;
  const lines: { label: string; days: number; ofDays: number; amount: number }[] = [];
  // Unpaid full months before the exit month (only after a payroll run exists, at most 3)
  if (lastPaid && monthly) {
    let y = lastPaid.year;
    let m = lastPaid.month + 1;
    if (m > 12) [y, m] = [y + 1, 1];
    while ((y < ey || (y === ey && m < em)) && lines.length < 3) {
      const total = daysIn(y, m);
      lines.push({ label: `${MONTHS[m - 1]} ${y}`, days: total, ofDays: total, amount: round(monthly) });
      m++;
      if (m > 12) [y, m] = [y + 1, 1];
    }
  }
  const exitMonthPaid = lastPaid && (lastPaid.year > ey || (lastPaid.year === ey && lastPaid.month >= em));
  if (!exitMonthPaid && monthly) {
    const total = daysIn(ey, em);
    const fromDay = joined.slice(0, 7) === exitDate.slice(0, 7) ? Number(joined.slice(8, 10)) : 1;
    const days = Math.max(0, ed - fromDay + 1);
    lines.push({ label: `${MONTHS[em - 1]} ${ey} (till ${ed} ${MONTHS[em - 1]})`, days, ofDays: total, amount: round((monthly / total) * days) });
  }

  const employee = await getEmployeeById(companyId, id);
  const balances = await getBalances(companyId, employee, exitDate);
  const leave = BALANCE_TYPES.map((t) => ({ type: t, label: LEAVE_LABELS[t], available: Number(balances[t].available) })).filter((l) => l.available > 0);

  const servedDays = e.started_on ? Math.max(0, Math.round((Date.parse(exitDate) - Date.parse(e.started_on)) / 86400000)) : null;
  return {
    monthlyGross: round(monthly),
    salarySource: source,
    perDay: round(monthly / 30),
    salary: { lines, total: round(lines.reduce((t, l) => t + l.amount, 0)), exitMonthPaid: Boolean(exitMonthPaid) },
    leave,
    notice: { startedOn: e.started_on, exitDate, servedDays, waived: e.exit_reason === "terminated" },
  };
}

export async function saveInterview(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof interviewSchema>) {
  const e = await findExit(companyId, id);
  await ensureExitRecord(companyId, id);
  await db
    .update(employeeExits)
    .set({ interview_notes: input.notes ?? null, interview_rating: input.rating ?? null, would_rejoin: input.wouldRejoin ?? null })
    .where(eq(employeeExits.employee_id, id));
  audit(actor, { companyId, action: "exit.interview", target: ["employee", id], summary: `Recorded the exit interview of ${e.name}` });
  return exitDetail(companyId, id);
}

// Close the exit: left, cleared, assets back, F&F paid
export async function completeExitRecord(companyId: number, actor: Express.AuthUser, id: number) {
  const e = await findExit(companyId, id);
  await ensureExitRecord(companyId, id);
  if (e.status !== "exited") throw new BadRequestError(`${e.name} is still serving notice`);
  if (e.pending_items > 0 || e.open_assets > 0) throw new BadRequestError("Clearance isn't finished yet");
  const [r] = await db.select({ s: employeeExits.settlement_status }).from(employeeExits).where(eq(employeeExits.employee_id, id));
  if (r?.s !== "paid") throw new BadRequestError("Mark the full & final as paid first");
  await db.update(employeeExits).set({ completed_at: new Date() }).where(eq(employeeExits.employee_id, id));
  audit(actor, { companyId, action: "exit.completed", target: ["employee", id], summary: `Closed the exit of ${e.name}` });
  return exitDetail(companyId, id);
}
