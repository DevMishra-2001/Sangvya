// End-of-day attendance check. A punch-out may just be the start of a break (the
// employee can punch in again the same day), so a day is only judged once it's
// over. Every few minutes this looks at past days not checked yet and tells the
// reporting manager and the employee (bell + email) about short days, long
// breaks or a missing check-out.
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { attendance } from "../db/schema.js";
import { getAttendanceSettings, type AttendanceSettings } from "../modules/attendance/attendanceSettings.service.js";
import { notify } from "../modules/notifications/notify.js";
import { trackJob } from "./trackJob.js";
import { formatMinutes, localDate, localTime, summarize, zonedDateTime, type DaySummary } from "../utils/workday.js";
import { rulesFor, toMinutes, type ShiftRules } from "../modules/shifts/shiftRules.js";
import { breaksFor, findDaysToClose, markDayClosed, type AttendanceBreak, type AttendanceRecord } from "../modules/attendance/attendance.service.js";
import { findEmployeeById } from "../modules/employees/employees.service.js";

const RUN_EVERY_MS = 15 * 60 * 1000;

// The reporting manager and the employee both hear about it (bell + email)
async function notifyDay(record: AttendanceRecord, breaks: AttendanceBreak[], totals: DaySummary, rules: ShiftRules) {
  const emp = await findEmployeeById(record.company_id, record.employee_id);
  if (!emp) return;
  const issues: string[] = [];
  if (!record.punch_out) issues.push("Didn't check out");
  if (totals.shortDay) issues.push(`Total time ${formatMinutes(totals.totalMinutes)} is less than the required ${formatMinutes(rules.requiredMinutes)} (${rules.shiftName})`);
  if (totals.longBreak) issues.push(`Break time ${formatMinutes(totals.breakMinutes)} is more than the allowed ${formatMinutes(rules.maxBreakMinutes)}`);
  const times = {
    punchIn: record.punch_in ? localTime(record.punch_in) : "—",
    punchOut: record.punch_out ? localTime(record.punch_out) : "—",
    breaks: `${formatMinutes(totals.breakMinutes)} (${breaks.length})`,
    total: formatMinutes(totals.totalMinutes),
  };
  const kind = !record.punch_out ? "missing_checkout" : totals.shortDay ? "short_day" : "long_break";
  const summary = issues.join(" · ");

  if (emp.manager_id) {
    await notify({
      companyId: record.company_id,
      to: [{ employeeId: emp.manager_id }],
      type: `attendance.${kind}`,
      title: `${emp.name}: ${kind === "missing_checkout" ? "no check-out" : kind === "short_day" ? "short day" : "long break"} on ${record.date}`,
      body: summary,
      link: "/my-team",
      entity: ["attendance", record.id],
      email: (r) => ({ template: "attendanceAlert", props: { name: r.name, employeeName: emp.name, date: record.date, issues, ...times, forEmployee: false } }),
    });
  }
  await notify({
    companyId: record.company_id,
    to: [{ employeeId: emp.id }],
    type: `attendance.${kind}`,
    title: `Your attendance on ${record.date} needs attention`,
    body: `${summary}. Wrong? Ask for a correction.`,
    link: "/my-attendance/corrections",
    entity: ["attendance", record.id],
    email: (r) => ({ template: "attendanceAlert", props: { name: r.name, employeeName: emp.name, date: record.date, issues, ...times, forEmployee: true } }),
  });
}

// Missing check-out: the company decides — just flag it, check out at the shift's end, or make it a half day
async function applyMissingCheckout(record: AttendanceRecord, rules: ShiftRules, a: AttendanceSettings): Promise<AttendanceRecord> {
  if (record.punch_out || !record.punch_in) return record;
  if (a.missing_checkout === "half") {
    await db.update(attendance).set({ status: "half" }).where(eq(attendance.id, record.id));
    return { ...record, status: "half" };
  }
  if (a.missing_checkout === "shift_end") {
    const overnight = toMinutes(rules.end) <= toMinutes(rules.start);
    const endDay = overnight ? new Date(Date.parse(`${record.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : record.date;
    const end = zonedDateTime(endDay, rules.end);
    if (end > new Date(record.punch_in)) {
      await db.update(attendance).set({ punch_out: end }).where(eq(attendance.id, record.id));
      return { ...record, punch_out: end };
    }
  }
  return record;
}

// Present / half day / absent from the time between check-in and check-out (when the company turns it on)
async function applyStatusByHours(record: AttendanceRecord, totals: DaySummary, a: AttendanceSettings) {
  if (!a.status_by_hours || !record.punch_out || record.status !== "present") return;
  const status = totals.totalMinutes < a.absent_below_minutes ? "absent" : totals.totalMinutes < a.half_day_below_minutes ? "half" : "present";
  if (status !== "present") await db.update(attendance).set({ status }).where(eq(attendance.id, record.id));
}

export async function closeFinishedDays() {
  const days = await findDaysToClose(localDate());
  const settingsCache = new Map<number, AttendanceSettings>();
  for (const found of days) {
    try {
      const a = settingsCache.get(found.company_id) ?? (await getAttendanceSettings(found.company_id));
      settingsCache.set(found.company_id, a);
      const breaks = (await breaksFor(found.company_id, [found.id]))[found.id] || [];
      const rules = await rulesFor(found.company_id, found.employee_id);
      // Alerts describe the day as the employee left it
      const asLeft = summarize(found, breaks, found.punch_out || found.punch_in || new Date(), rules);
      if (!found.punch_out || asLeft.shortDay || asLeft.longBreak) await notifyDay(found, breaks, asLeft, rules);
      const record = await applyMissingCheckout(found, rules, a);
      // A day without a punch-out is measured up to its last activity, not "now"
      const totals = summarize(record, breaks, record.punch_out || record.punch_in || new Date(), rules);
      await applyStatusByHours(record, totals, a);
      await markDayClosed(record.id);
    } catch (err) {
      console.error(`Day close failed for attendance ${found.id}:`, (err as Error).message);
    }
  }
}

export function startDayCloseJob() {
  const run = () => trackJob("Day close", closeFinishedDays);
  const firstRun = setTimeout(run, 10 * 1000); // shortly after startup, then on a schedule
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
