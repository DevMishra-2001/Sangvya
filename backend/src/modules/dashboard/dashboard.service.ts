// Company Admin / HR dashboard: the whole company at a glance, computed here so the browser doesn't download every employee and attendance row to count them.
import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  attendance,
  companies,
  companyMembers,
  departments,
  designations,
  employees,
  holidays,
  leavePolicies,
  leaveRequests,
} from "../../db/schema.js";
import { localDate } from "../../utils/workday.js";
import { alias } from "drizzle-orm/pg-core";
import { disabledModules } from "../pages/access.service.js";
import { pendingCorrectionCount } from "../attendance/corrections.service.js";

const manager = alias(employees, "manager");

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayCount = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

// The next time a yearly date (birthday, joining day) comes round, from today
function nextOccurrence(iso: string, today: string) {
  const [y] = today.split("-").map(Number);
  let next = `${y}${iso.slice(4, 10)}`;
  if (iso.slice(5, 10) === "02-29" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) next = `${y}-02-28`;
  if (next < today) next = `${y + 1}${iso.slice(4, 10)}`;
  return next;
}

export async function companyOverview(companyId: number) {
  const today = localDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const off = await disabledModules(companyId);
  const attendanceOn = !off.has("attendance");
  const leaveOn = !off.has("leave");

  const [company] = await db
    .select({ work_days: companies.work_days, logo_url: companies.logo_url })
    .from(companies)
    .where(eq(companies.id, companyId));

  const people = await db
    .select({ id: employees.id, name: employees.name, photo_url: employees.photo_url, join_date: employees.join_date, date_of_birth: employees.date_of_birth, created_at: employees.created_at })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), ne(employees.status, "exited"))); // people who left don't count
  const total = people.length;
  const [{ n: onNotice }] = await db
    .select({ n: count() })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), eq(employees.status, "notice")));
  const newThisMonth = people.filter((p) => (p.join_date ?? p.created_at?.toISOString().slice(0, 10) ?? "") >= monthStart).length;

  const [holidayToday] = await db
    .select({ name: holidays.name })
    .from(holidays)
    .where(and(eq(holidays.company_id, companyId), eq(holidays.date, today), eq(holidays.is_optional, false)));
  const workDays = company?.work_days ? company.work_days.split(",") : ["mon", "tue", "wed", "thu", "fri", "sat"];
  const weekday = DAY_KEYS[new Date(`${today}T00:00:00Z`).getUTCDay()];
  const isWorkingDay = workDays.includes(weekday) && !holidayToday;

  // ---- Leave: who's away today, what's waiting for approval ----
  let onLeaveIds = new Set<number>();
  let leave: null | {
    pendingCount: number;
    pending: { id: number; employee_name: string; leave_type: string; from_date: string; to_date: string; days: number; approver_name: string | null }[];
  } = null;
  if (leaveOn) {
    const away = await db
      .select({ employee_id: leaveRequests.employee_id })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.company_id, companyId), eq(leaveRequests.status, "approved"), lte(leaveRequests.from_date, today), gte(leaveRequests.to_date, today)));
    onLeaveIds = new Set(away.map((r) => r.employee_id));
    const [{ n }] = await db
      .select({ n: count() })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.company_id, companyId), eq(leaveRequests.status, "pending")));
    const pending = await db
      .select({
        id: leaveRequests.id,
        employee_name: employees.name,
        leave_type: leaveRequests.leave_type,
        from_date: leaveRequests.from_date,
        to_date: leaveRequests.to_date,
        // Decided by their reporting manager; HR only when there's none (or they left)
        approver_name: sql<string | null>`case when ${manager.status} <> 'exited' then ${manager.name} end`,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employee_id))
      .leftJoin(manager, eq(manager.id, employees.manager_id))
      .where(and(eq(leaveRequests.company_id, companyId), eq(leaveRequests.status, "pending")))
      .orderBy(asc(leaveRequests.from_date))
      .limit(5);
    leave = { pendingCount: n, pending: pending.map((p) => ({ ...p, days: dayCount(p.from_date, p.to_date) })) };
  }

  // ---- Attendance today + missing punch-outs ----
  let today_: null | { present: number; late: number; onLeave: number; notIn: number; rate: number } = null;
  let missingPunchOuts: { employee_name: string; date: string }[] = [];
  let missingPunchOutCount = 0;
  if (attendanceOn) {
    const rows = await db
      .select({ employee_id: attendance.employee_id, status: attendance.status, late: sql<boolean>`coalesce(${attendance.late_minutes}, 0) > 0` })
      .from(attendance)
      .where(and(eq(attendance.company_id, companyId), eq(attendance.date, today)));
    const presentRows = rows.filter((r) => r.status === "present" || r.status === "half");
    const present = presentRows.length;
    const presentIds = new Set(presentRows.map((r) => r.employee_id));
    const onLeave = [...onLeaveIds].filter((id) => !presentIds.has(id)).length;
    const notIn = isWorkingDay ? Math.max(0, total - present - onLeave) : 0;
    today_ = { present, late: presentRows.filter((r) => r.late).length, onLeave, notIn, rate: total ? Math.round((present / total) * 1000) / 10 : 0 };

    // Punched in but never out, over the last 7 days (before today)
    const missing = and(
      eq(attendance.company_id, companyId),
      gte(attendance.date, addDays(today, -7)),
      lt(attendance.date, today),
      isNotNull(attendance.punch_in),
      isNull(attendance.punch_out),
    );
    missingPunchOutCount = (await db.select({ n: count() }).from(attendance).where(missing))[0].n;
    missingPunchOuts = await db
      .select({ employee_name: employees.name, date: attendance.date })
      .from(attendance)
      .innerJoin(employees, eq(employees.id, attendance.employee_id))
      .where(missing)
      .orderBy(desc(attendance.date))
      .limit(5);
  }

  // ---- Upcoming: birthdays, work anniversaries (next 7 days), holidays (next 30) ----
  const weekEnd = addDays(today, 6);
  const birthdays = people
    .filter((p) => p.date_of_birth)
    .map((p) => ({ id: p.id, name: p.name, photo_url: p.photo_url, date: nextOccurrence(p.date_of_birth!, today) }))
    .filter((b) => b.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const anniversaries = people
    .filter((p) => p.join_date && p.join_date < today)
    .map((p) => {
      const date = nextOccurrence(p.join_date!, today);
      return { id: p.id, name: p.name, photo_url: p.photo_url, date, years: Number(date.slice(0, 4)) - Number(p.join_date!.slice(0, 4)) };
    })
    .filter((a) => a.years >= 1 && a.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingHolidays = await db
    .select({ date: holidays.date, name: holidays.name, is_optional: holidays.is_optional })
    .from(holidays)
    .where(and(eq(holidays.company_id, companyId), gte(holidays.date, today), lte(holidays.date, addDays(today, 30))))
    .orderBy(asc(holidays.date))
    .limit(5);

  // ---- Headcount by department ----
  const byDept = await db
    .select({ name: departments.name, n: sql<number>`count(${employees.id})::int` })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.department_id))
    .where(and(eq(employees.company_id, companyId), ne(employees.status, "exited")))
    .groupBy(departments.name)
    .orderBy(desc(sql`count(${employees.id})`));

  // ---- Setup checklist (onboarding progress) ----
  const exists = async (q: Promise<{ n: number }[]>) => ((await q)[0]?.n ?? 0) > 0;
  const [hasDepartments, hasDesignations, hasHolidays, hasPolicy, logins] = await Promise.all([
    exists(db.select({ n: count() }).from(departments).where(eq(departments.company_id, companyId))),
    exists(db.select({ n: count() }).from(designations).where(eq(designations.company_id, companyId))),
    exists(db.select({ n: count() }).from(holidays).where(eq(holidays.company_id, companyId))),
    exists(db.select({ n: count() }).from(leavePolicies).where(eq(leavePolicies.company_id, companyId))),
    db.select({ n: count() }).from(companyMembers).where(eq(companyMembers.company_id, companyId)),
  ]);
  const setup = [
    { key: "logo", label: "Add your company logo", done: Boolean(company?.logo_url), url: null },
    { key: "departments", label: "Add departments", done: hasDepartments, url: "/departments" },
    { key: "designations", label: "Add designations (job titles)", done: hasDesignations, url: "/designations" },
    { key: "employees", label: "Add your employees", done: total > 1, url: "/employees" },
    { key: "logins", label: "Give employees a login", done: logins[0].n > 1, url: "/employees" },
    ...(attendanceOn || leaveOn ? [{ key: "holidays", label: "Add this year's holidays", done: hasHolidays, url: "/holidays" }] : []),
    ...(leaveOn ? [{ key: "leave-policy", label: "Review the leave policy", done: hasPolicy, url: "/leave-policy" }] : []),
  ];

  return {
    date: today,
    workingDay: { isWorkingDay, holiday: holidayToday?.name ?? null },
    headcount: { total, newThisMonth, onNotice },
    attendance: today_,
    leave,
    alerts: attendanceOn ? { missingPunchOutCount, missingPunchOuts } : null,
    // Attendance corrections waiting for a decision (manager or HR)
    corrections: attendanceOn ? { pendingCount: await pendingCorrectionCount(companyId) } : null,
    upcoming: { birthdays, anniversaries, holidays: upcomingHolidays },
    departments: byDept.map((d) => ({ name: d.name ?? "No department", count: d.n })),
    setup,
  };
}
