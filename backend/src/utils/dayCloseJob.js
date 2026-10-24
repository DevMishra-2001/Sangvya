// End-of-day attendance check. A punch-out may just be the start of a break (the
// employee can punch in again the same day), so a day is only judged once it's
// over. Every few minutes this looks at past days not checked yet and emails the
// reporting manager about short days, long breaks or a missing punch-out.
const AttendanceModel = require("../models/attendanceModel");
const EmployeeModel = require("../models/employeeModel");
const { sendMail } = require("./mailer");
const { REQUIRED_MINUTES, MAX_BREAK_MINUTES, localDate, localTime, summarize, formatMinutes } = require("./workday");

const RUN_EVERY_MS = 15 * 60 * 1000;

async function notifyManager(record, breaks, totals) {
  const emp = await EmployeeModel.findWithManager(record.company_id, record.employee_id);
  if (!emp?.manager_email) {
    console.log(`No manager email for employee ${record.employee_id} — skipped attendance alert`);
    return;
  }
  const issues = [];
  if (!record.punch_out) issues.push("Didn't punch out");
  if (totals.shortDay) issues.push(`Total time ${formatMinutes(totals.totalMinutes)} is less than the required ${formatMinutes(REQUIRED_MINUTES)}`);
  if (totals.longBreak) issues.push(`Break time ${formatMinutes(totals.breakMinutes)} is more than the allowed ${formatMinutes(MAX_BREAK_MINUTES)}`);

  await sendMail({
    to: emp.manager_email,
    subject: `Attendance alert: ${emp.name} — ${record.date}`,
    text: [
      `Hi ${emp.manager_name || ""},`,
      "",
      `${emp.name}'s attendance on ${record.date} needs your attention:`,
      ...issues.map((i) => `  • ${i}`),
      "",
      `First punch in: ${localTime(record.punch_in)}`,
      `Last punch out: ${record.punch_out ? localTime(record.punch_out) : "—"}`,
      `Breaks:         ${formatMinutes(totals.breakMinutes)} (${breaks.length})`,
      `Total:          ${formatMinutes(totals.totalMinutes)}`,
    ].join("\n"),
  });
}

async function closeFinishedDays() {
  const days = await AttendanceModel.findDaysToClose(localDate());
  for (const record of days) {
    try {
      const breaks = (await AttendanceModel.breaksFor(record.company_id, [record.id]))[record.id] || [];
      // A day without a punch-out is measured up to its last activity, not "now"
      const totals = summarize(record, breaks, record.punch_out || record.punch_in);
      if (!record.punch_out || totals.shortDay || totals.longBreak) await notifyManager(record, breaks, totals);
      await AttendanceModel.markDayClosed(record.id);
    } catch (err) {
      console.error(`Day close failed for attendance ${record.id}:`, err.message);
    }
  }
}

function startDayCloseJob() {
  const run = () => closeFinishedDays().catch((err) => console.error("Day close job failed:", err.message));
  setTimeout(run, 10 * 1000); // shortly after startup, then on a schedule
  return setInterval(run, RUN_EVERY_MS);
}

module.exports = { startDayCloseJob, closeFinishedDays };
