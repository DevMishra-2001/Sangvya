// End-of-day attendance check. A punch-out may just be the start of a break (the
// employee can punch in again the same day), so a day is only judged once it's
// over. Every few minutes this looks at past days not checked yet and tells the
// reporting manager and the employee (bell + email) about short days, long
// breaks or a missing check-out.
import { notify } from "../modules/notifications/notify.js";
import { formatMinutes, localDate, localTime, summarize, type DaySummary } from "../utils/workday.js";
import { rulesFor, type ShiftRules } from "../modules/shifts/shiftRules.js";
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

export async function closeFinishedDays() {
  const days = await findDaysToClose(localDate());
  for (const record of days) {
    try {
      const breaks = (await breaksFor(record.company_id, [record.id]))[record.id] || [];
      // A day without a punch-out is measured up to its last activity, not "now"
      const rules = await rulesFor(record.company_id, record.employee_id);
      const totals = summarize(record, breaks, record.punch_out || record.punch_in || new Date(), rules);
      if (!record.punch_out || totals.shortDay || totals.longBreak) await notifyDay(record, breaks, totals, rules);
      await markDayClosed(record.id);
    } catch (err) {
      console.error(`Day close failed for attendance ${record.id}:`, (err as Error).message);
    }
  }
}

export function startDayCloseJob() {
  const run = () => closeFinishedDays().catch((err) => console.error("Day close job failed:", (err as Error).message));
  const firstRun = setTimeout(run, 10 * 1000); // shortly after startup, then on a schedule
  const interval = setInterval(run, RUN_EVERY_MS);
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}
