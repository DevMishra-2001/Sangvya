// Leave types, rules and balances. Everything comes from the company's Leave Settings:
//   quota types   a quota per leave year or per month (or no limit). Yearly ones can carry
//                 unused days forward (none / all / up to a max). OL may use the employee's own quota.
//   comp off      earned for a weekly off / holiday worked (full or half by the time worked),
//                 valid for the company's comp-off days from that day
//   unpaid        no balance; payroll counts the days as loss of pay
// Leave days skip weekly offs and holidays (unless the sandwich rule is on); a half day counts 0.5.
// Pending requests count as used, so the same balance can't be requested twice.
import { and, asc, between, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { attendance, holidays, leaveRequests, leaveSettings, leaveTypes } from "../../db/schema.js";
import { localDate } from "../../utils/workday.js";
import { workCalendar, type WorkCalendar } from "../companies/workCalendar.js";
import type { Employee } from "../employees/employees.service.js";

export type LeaveTypeRow = typeof leaveTypes.$inferSelect;
export type LeaveSettingsRow = typeof leaveSettings.$inferSelect;

const MAX_CARRY_YEARS = 10; // how far back carry-forward is worked out
const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));

function monthRange(dateIso: string) {
  const [y, m] = dateIso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${dateIso.slice(0, 7)}-01`, end: `${dateIso.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

// ---- Types and rules ----

const DEFAULT_TYPES = [
  { code: "cl", name: "Casual Leave", short_name: "CL", color: "#2563eb", kind: "quota", is_paid: true, quota: "6", quota_period: "year", carry_forward: "none" },
  { code: "sl", name: "Sick Leave", short_name: "SL", color: "#dc2626", kind: "quota", is_paid: true, quota: "6", quota_period: "year", carry_forward: "all" },
  { code: "ol", name: "Optional Leave", short_name: "OL", color: "#7c3aed", kind: "quota", is_paid: true, quota: "2", quota_period: "year", carry_forward: "none", optional_holidays_only: true },
  { code: "el", name: "Earned Leave", short_name: "EL", color: "#16a34a", kind: "quota", is_paid: true, quota: "1", quota_period: "month", carry_forward: "none" },
  { code: "comp_off", name: "Comp Off", short_name: "Comp Off", color: "#f59e0b", kind: "comp_off", is_paid: true, quota: "0", quota_period: "none", carry_forward: "none" },
  { code: "lop", name: "Unpaid Leave", short_name: "LOP", color: "#64748b", kind: "unpaid", is_paid: false, quota: "0", quota_period: "none", carry_forward: "none" },
  { code: "leave", name: "Leave", short_name: "Leave", color: "#94a3b8", kind: "quota", is_paid: true, quota: "0", quota_period: "none", carry_forward: "none", is_active: false },
];

// The company's leave types (created with the defaults the first time)
export async function leaveTypesOf(companyId: number): Promise<LeaveTypeRow[]> {
  const rows = await db.select().from(leaveTypes).where(eq(leaveTypes.company_id, companyId)).orderBy(asc(leaveTypes.sort_order), asc(leaveTypes.id));
  if (rows.length) return rows;
  await db
    .insert(leaveTypes)
    .values(DEFAULT_TYPES.map((t, i) => ({ ...t, company_id: companyId, is_system: true, sort_order: i + 1 })))
    .onConflictDoNothing();
  return db.select().from(leaveTypes).where(eq(leaveTypes.company_id, companyId)).orderBy(asc(leaveTypes.sort_order), asc(leaveTypes.id));
}

export async function leaveRulesOf(companyId: number): Promise<LeaveSettingsRow> {
  const [found] = await db.select().from(leaveSettings).where(eq(leaveSettings.company_id, companyId));
  if (found) return found;
  await db.insert(leaveSettings).values({ company_id: companyId }).onConflictDoNothing();
  const [row] = await db.select().from(leaveSettings).where(eq(leaveSettings.company_id, companyId));
  return row!;
}

// Older screens: the four quotas + comp-off validity, read from / written to the types
export async function getPolicy(companyId: number) {
  const [types, rules] = await Promise.all([leaveTypesOf(companyId), leaveRulesOf(companyId)]);
  const q = (code: string) => num(types.find((t) => t.code === code)?.quota);
  return { cl_per_year: q("cl"), sl_per_year: q("sl"), ol_per_year: q("ol"), el_per_month: q("el"), comp_off_valid_days: rules.comp_off_valid_days };
}

export async function updatePolicy(companyId: number, p: { clPerYear: number; slPerYear: number; olPerYear: number; elPerMonth: number; compOffValidDays?: number }) {
  await leaveTypesOf(companyId);
  for (const [code, quota] of [["cl", p.clPerYear], ["sl", p.slPerYear], ["ol", p.olPerYear], ["el", p.elPerMonth]] as const) {
    await db.update(leaveTypes).set({ quota: String(quota), updated_at: new Date() }).where(and(eq(leaveTypes.company_id, companyId), eq(leaveTypes.code, code)));
  }
  if (p.compOffValidDays != null) {
    await leaveRulesOf(companyId);
    await db.update(leaveSettings).set({ comp_off_valid_days: p.compOffValidDays, updated_at: new Date() }).where(eq(leaveSettings.company_id, companyId));
  }
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

// Leave days between two dates, inclusive. Weekly offs / holidays don't count — except, with the
// sandwich rule, the ones that fall between two leave days.
function leaveDays(cal: WorkCalendar, from: string, to: string, off: Set<string>, sandwich: boolean) {
  const working: string[] = [];
  let total = 0;
  for (let d = new Date(`${from}T00:00:00Z`); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    total++;
    const day = iso(d);
    if (!cal.isWeeklyOff(day) && !off.has(day)) working.push(day);
  }
  if (!sandwich || working.length < 2) return working.length;
  // Everything from the first to the last working day counts
  const span = (Date.parse(`${working.at(-1)}T00:00:00Z`) - Date.parse(`${working[0]}T00:00:00Z`)) / 86_400_000 + 1;
  return Math.min(total, span);
}

// Leave days in [from, to]; a half day is 0.5
export async function countLeaveDays(companyId: number, from: string, to: string, halfDay: string | null = null) {
  const [cal, rules, off] = await Promise.all([workCalendar(companyId), leaveRulesOf(companyId), holidaySet(companyId, from, to)]);
  const days = leaveDays(cal, from, to, off, rules.sandwich_rule);
  return halfDay ? days * 0.5 : days;
}

// Days of `type` leave (approved + pending) an employee has inside [from, to]
async function usedDays(cal: WorkCalendar, sandwich: boolean, companyId: number, employeeId: number, type: string, from: string, to: string) {
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
  const off = await holidaySet(companyId, from, to);
  return rows.reduce((sum, l) => {
    const days = leaveDays(cal, l.from_date > from ? l.from_date : from, l.to_date < to ? l.to_date : to, off, sandwich);
    return sum + (l.half_day ? days * 0.5 : days);
  }, 0);
}

// ---- Balances ----

export interface Balance {
  code: string;
  name: string;
  short: string;
  color: string;
  kind: string;
  period: string;
  unlimited: boolean;
  quota: number;
  used: number;
  available: number;
  carriedForward?: number;
  month?: string;
  earnedDates?: string[];
  validDays?: number;
}

// Unused days carried into this leave year (none / all / up to the type's max)
async function carriedForward(cal: WorkCalendar, sandwich: boolean, companyId: number, employee: Employee, t: LeaveTypeRow, quota: number, fy: ReturnType<WorkCalendar["leaveYear"]>) {
  if (t.carry_forward === "none") return 0;
  const firstYear = employee.join_date ? cal.leaveYear(employee.join_date).startYear : fy.startYear;
  const mm = String(cal.leaveYearStartMonth).padStart(2, "0");
  const cap = t.carry_forward === "max" ? num(t.carry_max) : Infinity;
  let carry = 0;
  for (let y = Math.max(firstYear, fy.startYear - MAX_CARRY_YEARS); y < fy.startYear; y++) {
    const year = cal.leaveYear(`${y}-${mm}-01`);
    const used = await usedDays(cal, sandwich, companyId, employee.id, t.code, year.start, year.end);
    carry = Math.min(cap, Math.max(0, carry + quota - used));
  }
  return carry;
}

// Comp off: weekly offs / holidays worked in the validity window (full or half by the time
// worked), minus comp off days (pending + approved) taken in that window
async function compOffBalance(cal: WorkCalendar, rules: LeaveSettingsRow, companyId: number, employeeId: number, today: string) {
  const days = rules.comp_off_valid_days;
  const from = iso(new Date(new Date(`${today}T00:00:00Z`).getTime() - days * 86400000));
  const worked = await db
    .select({ date: attendance.date, minutes: sql<number>`coalesce(extract(epoch from (${attendance.punch_out} - ${attendance.punch_in})) / 60, 0)::int` })
    .from(attendance)
    .leftJoin(holidays, and(eq(holidays.company_id, attendance.company_id), eq(holidays.date, attendance.date), eq(holidays.is_optional, false)))
    .where(
      and(
        eq(attendance.company_id, companyId),
        eq(attendance.employee_id, employeeId),
        between(attendance.date, from, today),
        or(isNotNull(attendance.punch_in), eq(attendance.status, "present")),
        or(cal.offDaySql(attendance.date), isNotNull(holidays.id)),
      ),
    )
    .orderBy(asc(attendance.date));
  // 0 = any check-in earns a full day
  const value = (m: number) => (rules.comp_off_full_minutes <= 0 || m >= rules.comp_off_full_minutes ? 1 : rules.comp_off_half_minutes > 0 && m >= rules.comp_off_half_minutes ? 0.5 : 0);
  const earnedRows = worked.map((w) => ({ date: w.date, value: value(w.minutes) })).filter((w) => w.value > 0);
  const earned = earnedRows.reduce((s, w) => s + w.value, 0);
  // Comp off leaves can be taken on future working days, so count from the window start onwards
  const used = await usedDays(cal, rules.sandwich_rule, companyId, employeeId, "comp_off", from, "9999-12-31");
  return { quota: earned, used, available: Math.max(0, earned - used), earnedDates: earnedRows.map((w) => w.date), validDays: days };
}

// Can this employee take this type at all (gender, probation)?
export function eligible(t: LeaveTypeRow, employee: Employee) {
  if (t.gender !== "all" && employee.gender !== t.gender) return false;
  if (t.after_probation && (employee.probation_status === "on_probation" || employee.probation_status === "extended")) return false;
  return true;
}

// Every balance-type for the employee, keyed by code (cl, sl, …) + the list in order
export async function getBalances(companyId: number, employee: Employee, asOf: string, today = asOf) {
  const [types, rules, cal] = await Promise.all([leaveTypesOf(companyId), leaveRulesOf(companyId), workCalendar(companyId)]);
  const fy = cal.leaveYear(asOf);
  const month = monthRange(asOf);
  const list: Balance[] = [];
  for (const t of types) {
    if (!t.is_active || t.kind === "unpaid" || !eligible(t, employee)) continue;
    const base = { code: t.code, name: t.name, short: t.short_name, color: t.color, kind: t.kind, period: t.quota_period };
    if (t.kind === "comp_off") {
      list.push({ ...base, unlimited: false, ...(await compOffBalance(cal, rules, companyId, employee.id, today)) });
      continue;
    }
    if (t.quota_period === "none") {
      const used = await usedDays(cal, rules.sandwich_rule, companyId, employee.id, t.code, fy.start, fy.end);
      list.push({ ...base, unlimited: true, quota: 0, used, available: 0 });
      continue;
    }
    if (t.quota_period === "month") {
      const quota = num(t.quota);
      const used = await usedDays(cal, rules.sandwich_rule, companyId, employee.id, t.code, month.start, month.end);
      list.push({ ...base, unlimited: false, quota, used, available: Math.max(0, quota - used), month: asOf.slice(0, 7) });
      continue;
    }
    // OL can use the employee's own yearly quota
    const yearly = t.code === "ol" && employee.ol_quota != null ? num(employee.ol_quota) : num(t.quota);
    const carried = await carriedForward(cal, rules.sandwich_rule, companyId, employee, t, yearly, fy);
    const used = await usedDays(cal, rules.sandwich_rule, companyId, employee.id, t.code, fy.start, fy.end);
    const quota = yearly + carried;
    list.push({ ...base, unlimited: false, quota, used, available: Math.max(0, quota - used), carriedForward: carried });
  }
  return {
    financialYear: { start: fy.start, end: fy.end }, // the leave year (name kept for the API)
    leaveYear: { start: fy.start, end: fy.end, kind: cal.leaveYearStartMonth === 1 ? "calendar" : "financial" },
    types: list,
    ...Object.fromEntries(list.map((b) => [b.code, b])),
  } as { financialYear: { start: string; end: string }; leaveYear: { start: string; end: string; kind: string }; types: Balance[] } & Record<string, Balance>;
}

// ---- Applying ----

export interface LeaveCheck {
  employee: Employee;
  type: string;
  from: string;
  to: string;
  halfDay: string | null;
  attachments: number;
  forSomeoneElse: boolean; // HR applying on someone's behalf skips notice / backdating limits
}

// Error message if this leave can't be taken, or the type to save it as (unpaid when the balance is short
// and the company allows that)
export async function checkLeave(companyId: number, c: LeaveCheck): Promise<{ error: string } | { type: string; note?: string }> {
  const [types, rules, cal] = await Promise.all([leaveTypesOf(companyId), leaveRulesOf(companyId), workCalendar(companyId)]);
  const t = types.find((x) => x.code === c.type);
  if (!t || !t.is_active) return { error: "Pick a valid leave type" };
  if (!eligible(t, c.employee)) return { error: `${t.name} isn't available to you${t.after_probation ? " until probation is over" : ""}` };
  if (c.halfDay && !t.allow_half_day) return { error: `${t.name} can't be taken as a half day` };

  const today = localDate();
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
  if (!c.forSomeoneElse) {
    if (c.from < today && rules.backdated_days != null && dayDiff(today, c.from) > rules.backdated_days) {
      return { error: rules.backdated_days === 0 ? "Leave can't be applied for past days" : `Leave can be applied at most ${rules.backdated_days} day${rules.backdated_days === 1 ? "" : "s"} back` };
    }
    if (t.min_notice_days && c.from >= today && dayDiff(c.from, today) < t.min_notice_days) {
      return { error: `${t.name} needs ${t.min_notice_days} day${t.min_notice_days === 1 ? "" : "s"}' notice` };
    }
  }

  const off = await holidaySet(companyId, c.from, c.to);
  const days = leaveDays(cal, c.from, c.to, off, rules.sandwich_rule) * (c.halfDay ? 0.5 : 1);
  if (days === 0) return { error: "These dates are all weekly offs / holidays — no leave needed" };
  if (t.max_days_per_request != null && days > num(t.max_days_per_request)) return { error: `${t.name} can be at most ${num(t.max_days_per_request)} days at a time` };
  if (t.document_after_days != null && days > num(t.document_after_days) && c.attachments === 0) {
    return { error: `Attach a supporting document — ${t.name} for more than ${num(t.document_after_days)} day${num(t.document_after_days) === 1 ? "" : "s"} needs one` };
  }
  if (t.kind === "unpaid") return { type: t.code };

  if (t.quota_period === "month" && c.from.slice(0, 7) !== c.to.slice(0, 7)) return { error: `${t.short_name} is a monthly leave — apply for each month separately` };
  if (t.quota_period === "year" && cal.leaveYear(c.from).start !== cal.leaveYear(c.to).start) {
    return { error: `A leave can't span two leave years — please split it at ${cal.leaveYear(c.from).end}` };
  }
  // Optional-holiday leave: only on the company's optional holidays (when it lists any this year)
  if (t.optional_holidays_only) {
    const year = cal.leaveYear(c.from);
    const optional = await db
      .select({ date: holidays.date })
      .from(holidays)
      .where(and(eq(holidays.company_id, companyId), eq(holidays.is_optional, true), between(holidays.date, year.start, year.end)));
    const allowed = new Set(optional.map((h) => h.date));
    if (allowed.size) {
      for (let d = new Date(`${c.from}T00:00:00Z`); iso(d) <= c.to; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = iso(d);
        if (!cal.isWeeklyOff(day) && !off.has(day) && !allowed.has(day)) return { error: `${t.short_name} can only be taken on your company's optional holidays — ${day} isn't one` };
      }
    }
  }
  if (t.quota_period === "none" && t.kind !== "comp_off") return { type: t.code };

  const balance = (await getBalances(companyId, c.employee, c.from, today))[t.code];
  const available = balance?.available ?? 0;
  if (days <= available) return { type: t.code };
  const unpaid = types.find((x) => x.kind === "unpaid" && x.is_active);
  if (rules.when_short === "unpaid" && unpaid) {
    return { type: unpaid.code, note: `Only ${available} ${t.short_name} left, so this was applied as ${unpaid.name}` };
  }
  return { error: `Not enough ${t.short_name} balance: you asked for ${days} day${days > 1 ? "s" : ""}, ${available} available` };
}
