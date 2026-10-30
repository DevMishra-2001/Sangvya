// Leave quotas and balances. The leave year follows the company's setup:
// calendar (Jan–Dec) or financial (Apr–Mar) — see companies/workCalendar.ts.
//   CL  quota per year, unused days lapse at year end
//   SL  quota per year, unused days carry forward to the next year
//   OL  quota per year — employees.ol_quota, else the company default
//   EL  quota per month, unused days are paid out at month end (encashment)
//   Comp Off  earned automatically: 1 for every weekly off / holiday the
//             employee checked in on; valid COMP_OFF_VALID_DAYS from that day
// Leave days exclude the company's weekly offs and holidays; a half day counts
// 0.5. Pending requests count as used, so the same balance can't be requested
// twice; rejected and cancelled ones don't count.
import { and, asc, between, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { attendance, holidays, leavePolicies, leaveRequests } from "../../db/schema.js";
import { localDate } from "../../utils/workday.js";
import { workCalendar, type WorkCalendar } from "../companies/workCalendar.js";
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
    // Optional holidays are working days (unless taken as OL)
    .where(and(eq(holidays.company_id, companyId), eq(holidays.is_optional, false), between(holidays.date, from, to)));
  return new Set(rows.map((r) => r.date));
}

// Working days (not a weekly off, not a holiday) between two dates, inclusive.
function workingDays(cal: WorkCalendar, from: string, to: string, holidayDates: Set<string>) {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = iso(d);
    if (!cal.isWeeklyOff(day) && !holidayDates.has(day)) n++;
  }
  return n;
}

// Leave days in [from, to]; a half day is 0.5 (if that day is a working day)
export async function countLeaveDays(companyId: number, from: string, to: string, halfDay: string | null = null) {
  const days = workingDays(await workCalendar(companyId), from, to, await holidaySet(companyId, from, to));
  return halfDay ? days * 0.5 : days;
}

// Days of `type` leave (approved + pending) an employee has inside [from, to].
async function usedDays(cal: WorkCalendar, companyId: number, employeeId: number, type: string, from: string, to: string) {
  const rows = await db
    .select({ from_date: leaveRequests.from_date, to_date: leaveRequests.to_date, half_day: leaveRequests.half_day })
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
  return rows.reduce((sum, l) => {
    const days = workingDays(cal, l.from_date > from ? l.from_date : from, l.to_date < to ? l.to_date : to, holidayDates);
    return sum + (l.half_day ? days * 0.5 : days);
  }, 0);
}

// ---- Balances ----

// SL available this leave year = this year's quota + unused SL carried from earlier years.
async function slCarryForward(cal: WorkCalendar, companyId: number, employee: Employee, policy: LeavePolicy, fy: ReturnType<WorkCalendar["leaveYear"]>) {
  const firstYear = employee.join_date ? cal.leaveYear(employee.join_date).startYear : fy.startYear;
  const mm = String(cal.leaveYearStartMonth).padStart(2, "0");
  let carry = 0;
  for (let y = Math.max(firstYear, fy.startYear - MAX_CARRY_YEARS); y < fy.startYear; y++) {
    const year = cal.leaveYear(`${y}-${mm}-01`);
    const used = await usedDays(cal, companyId, employee.id, "sl", year.start, year.end);
    carry = Math.max(0, carry + policy.sl_per_year - used);
  }
  return carry;
}

// Comp off: weekly offs / holidays worked in the validity window, minus comp
// off leave days (pending + approved) taken in that window.
async function compOffBalance(cal: WorkCalendar, companyId: number, employeeId: number, today: string) {
  const from = iso(new Date(new Date(`${today}T00:00:00Z`).getTime() - COMP_OFF_VALID_DAYS * 86400000));
  const worked = await db
    .select({ date: attendance.date })
    .from(attendance)
    .leftJoin(holidays, and(eq(holidays.company_id, attendance.company_id), eq(holidays.date, attendance.date), eq(holidays.is_optional, false)))
    .where(
      and(
        eq(attendance.company_id, companyId),
        eq(attendance.employee_id, employeeId),
        between(attendance.date, from, today),
        or(isNotNull(attendance.punch_in), eq(attendance.status, "present")),
        or(
          cal.offDows.length ? sql`extract(dow from ${attendance.date})::int in (${sql.join(cal.offDows.map((d) => sql`${d}`), sql`, `)})` : sql`false`,
          isNotNull(holidays.id),
        ),
      ),
    )
    .orderBy(asc(attendance.date));
  const earnedDates = worked.map((r) => r.date);
  // Comp off leaves can be taken on future working days, so count from the window start onwards
  const used = await usedDays(cal, companyId, employeeId, "comp_off", from, "9999-12-31");
  const earned = earnedDates.length;
  return { quota: earned, used, available: Math.max(0, earned - used), earnedDates, validDays: COMP_OFF_VALID_DAYS };
}

// { cl: { quota, used, available }, sl: {…, carriedForward}, ol: {…}, el: {…, month}, comp_off: {…} }
export async function getBalances(companyId: number, employee: Employee, asOf: string, today = asOf) {
  const policy = await getPolicy(companyId);
  const cal = await workCalendar(companyId);
  const fy = cal.leaveYear(asOf);
  const month = monthRange(asOf);
  const olQuota = employee.ol_quota != null ? Number(employee.ol_quota) : policy.ol_per_year;
  const carried = await slCarryForward(cal, companyId, employee, policy, fy);

  const make = async (type: string, quota: number, range: { start: string; end: string }) => {
    const used = await usedDays(cal, companyId, employee.id, type, range.start, range.end);
    return { quota, used, available: Math.max(0, quota - used) };
  };

  return {
    financialYear: { start: fy.start, end: fy.end }, // the leave year (name kept for the API)
    leaveYear: { start: fy.start, end: fy.end, kind: cal.leaveYearStartMonth === 1 ? "calendar" : "financial" },
    cl: await make("cl", policy.cl_per_year, fy),
    sl: { ...(await make("sl", policy.sl_per_year + carried, fy)), carriedForward: carried },
    ol: await make("ol", olQuota, fy),
    el: { ...(await make("el", policy.el_per_month, month)), month: asOf.slice(0, 7) },
    comp_off: await compOffBalance(cal, companyId, employee.id, today),
  };
}

// Error message if the employee can't take `type` leave for these dates, else null.
export async function balanceError(companyId: number, employee: Employee, type: string, from: string, to: string, halfDay: string | null = null) {
  if (!(BALANCE_TYPES as readonly string[]).includes(type)) return null;
  const balanceType = type as BalanceType;
  const cal = await workCalendar(companyId);

  const days = await countLeaveDays(companyId, from, to, halfDay);
  if (days === 0) return "These dates are all weekly offs / holidays — no leave needed";

  if (balanceType === "el" && from.slice(0, 7) !== to.slice(0, 7)) {
    return "EL is a monthly leave — apply for each month separately";
  }
  if (balanceType !== "el" && balanceType !== "comp_off" && cal.leaveYear(from).start !== cal.leaveYear(to).start) {
    return `A leave can't span two leave years — please split it at ${cal.leaveYear(from).end}`;
  }
  // OL is for optional holidays: if the company lists any this leave year, OL
  // can only be taken on those days
  if (balanceType === "ol") {
    const year = cal.leaveYear(from);
    const optional = await db
      .select({ date: holidays.date })
      .from(holidays)
      .where(and(eq(holidays.company_id, companyId), eq(holidays.is_optional, true), between(holidays.date, year.start, year.end)));
    const allowed = new Set(optional.map((h) => h.date));
    if (allowed.size) {
      const off = await holidaySet(companyId, from, to);
      for (let d = new Date(`${from}T00:00:00Z`); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayIso = iso(d);
        if (!cal.isWeeklyOff(dayIso) && !off.has(dayIso) && !allowed.has(dayIso)) {
          return `OL can only be taken on your company's optional holidays — ${dayIso} isn't one`;
        }
      }
    }
  }
  const balance = (await getBalances(companyId, employee, from, localDate()))[balanceType];
  if (days > balance.available) {
    return `Not enough ${LABELS[balanceType]} balance: you asked for ${days} day${days > 1 ? "s" : ""}, ${balance.available} available`;
  }
  return null;
}
