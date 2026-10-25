// Leave quotas and balances. The leave year is the financial year (1 Apr – 31 Mar).
//   CL  quota per year, unused days lapse at year end
//   SL  quota per year, unused days carry forward to the next year
//   OL  quota per year — employees.ol_quota, else the company default
//   EL  quota per month, unused days are paid out at month end (encashment)
//   Comp Off  earned automatically: 1 for every Sunday / holiday the employee
//             checked in on; valid COMP_OFF_VALID_DAYS from that day
// Leave days exclude Sundays and company holidays. Pending requests count as
// used, so the same balance can't be requested twice.
import { and, asc, between, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { attendance, holidays, leavePolicies, leaveRequests } from "../../db/schema.js";
import { isSunday, localDate } from "../../utils/workday.js";
import type { Employee } from "../employees/employees.service.js";

export const BALANCE_TYPES = ["cl", "sl", "ol", "el", "comp_off"] as const;
export type BalanceType = (typeof BALANCE_TYPES)[number];

const LABELS: Record<BalanceType, string> = { cl: "CL", sl: "SL", ol: "OL", el: "EL", comp_off: "Comp Off" };
const COMP_OFF_VALID_DAYS = env.COMP_OFF_VALID_DAYS;
const MAX_CARRY_YEARS = 10; // how far back SL carry-forward is computed

export interface LeavePolicy {
  cl_per_year: number;
  sl_per_year: number;
  ol_per_year: number;
  el_per_month: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Financial year containing a date: { start: "2026-04-01", end: "2027-03-31" }
export function financialYear(dateIso: string) {
  const [y, m] = dateIso.split("-").map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31`, startYear };
}

function monthRange(dateIso: string) {
  const [y, m] = dateIso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${dateIso.slice(0, 7)}-01`, end: `${dateIso.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

// ---- Policy ----

// The company's quotas; the row is created with defaults on first read.
export async function getPolicy(companyId: number): Promise<LeavePolicy> {
  const [p] = await db
    .insert(leavePolicies)
    .values({ company_id: companyId })
    .onConflictDoUpdate({ target: leavePolicies.company_id, set: { company_id: sql`excluded.company_id` } })
    .returning();
  return {
    cl_per_year: Number(p.cl_per_year),
    sl_per_year: Number(p.sl_per_year),
    ol_per_year: Number(p.ol_per_year),
    el_per_month: Number(p.el_per_month),
  };
}

export async function updatePolicy(
  companyId: number,
  { clPerYear, slPerYear, olPerYear, elPerMonth }: { clPerYear: number; slPerYear: number; olPerYear: number; elPerMonth: number },
) {
  await getPolicy(companyId); // make sure the row exists
  await db
    .update(leavePolicies)
    .set({
      cl_per_year: String(clPerYear),
      sl_per_year: String(slPerYear),
      ol_per_year: String(olPerYear),
      el_per_month: String(elPerMonth),
      updated_at: sql`now()`,
    })
    .where(eq(leavePolicies.company_id, companyId));
  return getPolicy(companyId);
}

// ---- Day counting ----

async function holidaySet(companyId: number, from: string, to: string) {
  const rows = await db
    .select({ date: holidays.date })
    .from(holidays)
    .where(and(eq(holidays.company_id, companyId), between(holidays.date, from, to)));
  return new Set(rows.map((r) => r.date));
}

// Working days (not Sunday, not a holiday) between two dates, inclusive.
function workingDays(from: string, to: string, holidayDates: Set<string>) {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = iso(d);
    if (!isSunday(day) && !holidayDates.has(day)) n++;
  }
  return n;
}

export async function countLeaveDays(companyId: number, from: string, to: string) {
  return workingDays(from, to, await holidaySet(companyId, from, to));
}

// Days of `type` leave (approved + pending) an employee has inside [from, to].
async function usedDays(companyId: number, employeeId: number, type: string, from: string, to: string) {
  const rows = await db
    .select({ from_date: leaveRequests.from_date, to_date: leaveRequests.to_date })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.company_id, companyId),
        eq(leaveRequests.employee_id, employeeId),
        eq(leaveRequests.leave_type, type),
        inArray(leaveRequests.status, ["approved", "pending"]),
        lte(leaveRequests.from_date, to),
        gte(leaveRequests.to_date, from),
      ),
    );
  if (rows.length === 0) return 0;
  const holidayDates = await holidaySet(companyId, from, to);
  return rows.reduce(
    (sum, l) => sum + workingDays(l.from_date > from ? l.from_date : from, l.to_date < to ? l.to_date : to, holidayDates),
    0,
  );
}

// ---- Balances ----

// SL available this financial year = this year's quota + unused SL carried from earlier years.
async function slCarryForward(companyId: number, employee: Employee, policy: LeavePolicy, fy: ReturnType<typeof financialYear>) {
  const firstYear = employee.join_date ? financialYear(employee.join_date).startYear : fy.startYear;
  let carry = 0;
  for (let y = Math.max(firstYear, fy.startYear - MAX_CARRY_YEARS); y < fy.startYear; y++) {
    const used = await usedDays(companyId, employee.id, "sl", `${y}-04-01`, `${y + 1}-03-31`);
    carry = Math.max(0, carry + policy.sl_per_year - used);
  }
  return carry;
}

// Comp off: Sundays/holidays worked in the validity window, minus comp off
// leave days (pending + approved) taken in that window.
async function compOffBalance(companyId: number, employeeId: number, today: string) {
  const from = iso(new Date(new Date(`${today}T00:00:00Z`).getTime() - COMP_OFF_VALID_DAYS * 86400000));
  const worked = await db
    .select({ date: attendance.date })
    .from(attendance)
    .leftJoin(holidays, and(eq(holidays.company_id, attendance.company_id), eq(holidays.date, attendance.date)))
    .where(
      and(
        eq(attendance.company_id, companyId),
        eq(attendance.employee_id, employeeId),
        between(attendance.date, from, today),
        or(isNotNull(attendance.punch_in), eq(attendance.status, "present")),
        or(sql`extract(dow from ${attendance.date}) = 0`, isNotNull(holidays.id)),
      ),
    )
    .orderBy(asc(attendance.date));
  const earnedDates = worked.map((r) => r.date);
  // Comp off leaves can be taken on future working days, so count from the window start onwards
  const used = await usedDays(companyId, employeeId, "comp_off", from, "9999-12-31");
  const earned = earnedDates.length;
  return { quota: earned, used, available: Math.max(0, earned - used), earnedDates, validDays: COMP_OFF_VALID_DAYS };
}

// { cl: { quota, used, available }, sl: {…, carriedForward}, ol: {…}, el: {…, month}, comp_off: {…} }
export async function getBalances(companyId: number, employee: Employee, asOf: string, today = asOf) {
  const policy = await getPolicy(companyId);
  const fy = financialYear(asOf);
  const month = monthRange(asOf);
  const olQuota = employee.ol_quota != null ? Number(employee.ol_quota) : policy.ol_per_year;
  const carried = await slCarryForward(companyId, employee, policy, fy);

  const make = async (type: string, quota: number, range: { start: string; end: string }) => {
    const used = await usedDays(companyId, employee.id, type, range.start, range.end);
    return { quota, used, available: Math.max(0, quota - used) };
  };

  return {
    financialYear: { start: fy.start, end: fy.end },
    cl: await make("cl", policy.cl_per_year, fy),
    sl: { ...(await make("sl", policy.sl_per_year + carried, fy)), carriedForward: carried },
    ol: await make("ol", olQuota, fy),
    el: { ...(await make("el", policy.el_per_month, month)), month: asOf.slice(0, 7) },
    comp_off: await compOffBalance(companyId, employee.id, today),
  };
}

// Error message if the employee can't take `type` leave for these dates, else null.
export async function balanceError(companyId: number, employee: Employee, type: string, from: string, to: string) {
  if (!(BALANCE_TYPES as readonly string[]).includes(type)) return null;
  const balanceType = type as BalanceType;

  const days = await countLeaveDays(companyId, from, to);
  if (days === 0) return "These dates are all Sundays/holidays — no leave needed";

  if (balanceType === "el" && from.slice(0, 7) !== to.slice(0, 7)) {
    return "EL is a monthly leave — apply for each month separately";
  }
  if (balanceType !== "el" && balanceType !== "comp_off" && financialYear(from).start !== financialYear(to).start) {
    return "A leave can't span two financial years — please split it at 31 March";
  }
  const balance = (await getBalances(companyId, employee, from, localDate()))[balanceType];
  if (days > balance.available) {
    return `Not enough ${LABELS[balanceType]} balance: you asked for ${days} day${days > 1 ? "s" : ""}, ${balance.available} available`;
  }
  return null;
}
