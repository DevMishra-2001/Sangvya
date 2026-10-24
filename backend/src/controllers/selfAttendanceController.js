// The logged-in employee's own attendance: punch in/out, breaks, and the
// month calendar (attendance + holidays + leaves).
const AttendanceModel = require("../models/attendanceModel");
const HolidayModel = require("../models/holidayModel");
const LeaveModel = require("../models/leaveModel");
const EmployeeModel = require("../models/employeeModel");
const {
  REQUIRED_MINUTES, MAX_BREAK_MINUTES, localDate, isSunday, summarize,
} = require("../utils/workday");
const { getBalances, countLeaveDays } = require("../utils/leaveBalance");
const { LOCATIONS, dayFlags, primaryStatus } = require("../utils/attendanceStatus");

const RULES = { requiredMinutes: REQUIRED_MINUTES, maxBreakMinutes: MAX_BREAK_MINUTES };

// Shape one attendance row (+ its breaks) for the frontend.
// Punch log → work sessions: [{ in, inLocation, inRemarks, out, outLocation, outRemarks }]
function toSessions(punches) {
  const sessions = [];
  for (const p of punches) {
    if (p.kind === "in") {
      sessions.push({ in: p.punched_at, inLocation: p.location, inRemarks: p.remarks, out: null, outLocation: null, outRemarks: null });
    } else if (sessions.length && !sessions[sessions.length - 1].out) {
      Object.assign(sessions[sessions.length - 1], { out: p.punched_at, outLocation: p.location, outRemarks: p.remarks });
    }
  }
  return sessions;
}

function dayPayload(record, breaks = [], now = new Date(), punches = []) {
  if (!record) return null;
  return {
    id: record.id,
    date: record.date,
    status: record.status,
    punchIn: record.punch_in,
    punchOut: record.punch_out,
    punchInLocation: record.punch_in_location,
    punchInRemarks: record.punch_in_remarks,
    punchOutLocation: record.punch_out_location,
    punchOutRemarks: record.punch_out_remarks,
    breaks: breaks.map((b) => ({ start: b.break_start, end: b.break_end })),
    sessions: toSessions(punches),
    ...summarize(record, breaks, now),
  };
}

async function withBreaks(companyId, record) {
  if (!record) return null;
  const breaks = (await AttendanceModel.breaksFor(companyId, [record.id]))[record.id] || [];
  const punches = (await AttendanceModel.punchesFor(companyId, [record.id]))[record.id] || [];
  return dayPayload(record, breaks, new Date(), punches);
}

// The day to show/act on: a still-open shift if there is one, otherwise today's row.
async function currentRecord(req) {
  const today = localDate();
  return (
    (await AttendanceModel.findOpen(req.companyId, req.user.employeeId, today)) ||
    (await AttendanceModel.findOne(req.companyId, req.user.employeeId, today))
  );
}

// GET /api/me/today
async function today(req, res) {
  const date = localDate();
  const record = await currentRecord(req);
  const holiday = await HolidayModel.findByDate(req.companyId, date);
  res.json({ date, isSunday: isSunday(date), holiday: holiday || null, day: await withBreaks(req.companyId, record), rules: RULES });
}

// Optional { location, remarks } sent with check-in / check-out (validated in routes)
const punchDetails = (req) => ({
  location: req.body?.location || null,
  remarks: req.body?.remarks?.trim() || null,
});

// POST /api/me/punch-in
// First punch of the day starts it. Punching in again after a punch-out the same
// day ends the "away" time: last punch-out → now is recorded as a break.
async function punchIn(req, res) {
  const today = localDate();
  const open = await AttendanceModel.findOpen(req.companyId, req.user.employeeId, today);
  if (open) return res.status(400).json({ error: "You're already punched in — punch out first" });

  // The time is always the server's "now" — employees can't pick it
  const now = new Date();
  const existing = await AttendanceModel.findOne(req.companyId, req.user.employeeId, today);
  const record = existing?.punch_in
    ? await AttendanceModel.resume(req.companyId, existing.id, now)
    : await AttendanceModel.punchIn(req.companyId, req.user.employeeId, today, now, punchDetails(req));
  if (!record) return res.status(409).json({ error: "Your attendance just changed — please refresh" });
  await AttendanceModel.logPunch(req.companyId, record.id, "in", now, punchDetails(req));
  res.status(201).json({ day: await withBreaks(req.companyId, record) });
}

// POST /api/me/break-start / break-end — kept for API compatibility; the app
// now treats punch-out → punch-in as the break.
async function breakStart(req, res) {
  const open = await AttendanceModel.findOpen(req.companyId, req.user.employeeId, localDate());
  if (!open) return res.status(400).json({ error: "Punch in first" });

  const day = await withBreaks(req.companyId, open);
  if (day.onBreak) return res.status(400).json({ error: "You're already on a break" });

  await AttendanceModel.startBreak(req.companyId, open.id, new Date());
  res.json({ day: await withBreaks(req.companyId, open) });
}

async function breakEnd(req, res) {
  const open = await AttendanceModel.findOpen(req.companyId, req.user.employeeId, localDate());
  if (!open) return res.status(400).json({ error: "Punch in first" });

  const ended = await AttendanceModel.endBreak(req.companyId, open.id, new Date());
  if (!ended) return res.status(400).json({ error: "You're not on a break" });
  res.json({ day: await withBreaks(req.companyId, open) });
}

// POST /api/me/punch-out — stops the work clock. If the employee punches in again
// today, the time in between becomes a break; if not, the day ends here.
// (The manager alert runs after the day is over — see utils/dayCloseJob.js.)
async function punchOut(req, res) {
  const open = await AttendanceModel.findOpen(req.companyId, req.user.employeeId, localDate());
  if (!open) return res.status(400).json({ error: "You're not punched in" });

  const now = new Date();
  await AttendanceModel.endBreak(req.companyId, open.id, now);
  const record = await AttendanceModel.punchOut(req.companyId, open.id, now, punchDetails(req));
  if (!record) return res.status(409).json({ error: "Your attendance just changed — please refresh" });
  await AttendanceModel.logPunch(req.companyId, record.id, "out", now, punchDetails(req));
  res.json({ day: await withBreaks(req.companyId, record) });
}

// GET /api/me/calendar?month=YYYY-MM
async function calendar(req, res) {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : localDate().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

  const records = await AttendanceModel.findByEmployee(req.companyId, req.user.employeeId, from, to);
  const breaks = await AttendanceModel.breaksFor(req.companyId, records.map((r) => r.id));
  const punches = await AttendanceModel.punchesFor(req.companyId, records.map((r) => r.id));
  const holidays = await HolidayModel.findInRange(req.companyId, from, to);
  const leaves = await LeaveModel.findOverlapping(req.companyId, req.user.employeeId, from, to, { includeRejected: true });

  const employee = await EmployeeModel.findById(req.companyId, req.user.employeeId);
  res.json({
    month,
    today: localDate(),
    employee: { id: employee.id, name: employee.name },
    days: records.map((r) => dayPayload(r, breaks[r.id] || [], new Date(), punches[r.id] || [])),
    holidays,
    leaves,
    balances: await getBalances(req.companyId, employee, localDate()),
    rules: RULES,
  });
}

const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
const isMonth = (v) => /^\d{4}-\d{2}$/.test(v || "");
function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}` };
}

// GET /api/me/attendance?date=YYYY-MM-DD — one day for the Attendance tab:
// the record, its status flags (legend counts) and the main status.
async function attendanceDay(req, res) {
  const today = localDate();
  const date = isIsoDate(req.query.date) ? req.query.date : today;
  const employee = await EmployeeModel.findById(req.companyId, req.user.employeeId);
  const record = await AttendanceModel.findOne(req.companyId, req.user.employeeId, date);
  const day = await withBreaks(req.companyId, record);
  const holiday = await HolidayModel.findByDate(req.companyId, date);
  const leaves = (await LeaveModel.findOverlapping(req.companyId, req.user.employeeId, date, date)) || [];
  const flags = dayFlags({ date, today, day, holiday, leaves });

  res.json({
    date,
    today,
    employee: { id: employee.id, name: employee.name, code: employee.employee_code },
    day,
    holiday: holiday || null,
    leaves,
    flags,
    status: primaryStatus(flags),
    locations: LOCATIONS,
    rules: RULES,
  });
}

// GET /api/me/leave-balance — CL / SL / OL / EL for today
async function leaveBalance(req, res) {
  const employee = await EmployeeModel.findById(req.companyId, req.user.employeeId);
  res.json({ balances: await getBalances(req.companyId, employee, localDate()) });
}

// GET /api/me/leaves?month=YYYY-MM — this month's leave requests with day counts
async function myLeaves(req, res) {
  const month = isMonth(req.query.month) ? req.query.month : localDate().slice(0, 7);
  const { from, to } = monthBounds(month);
  const employee = await EmployeeModel.findById(req.companyId, req.user.employeeId);
  const leaves = await LeaveModel.findForEmployeeInRange(req.companyId, req.user.employeeId, from, to);
  const withDays = [];
  for (const l of leaves) {
    // Days inside this month only (a leave may run into the next month)
    const start = l.from_date > from ? l.from_date : from;
    const end = l.to_date < to ? l.to_date : to;
    withDays.push({ ...l, days: await countLeaveDays(req.companyId, start, end), monthFrom: start, monthTo: end });
  }
  res.json({ month, employee: { id: employee.id, name: employee.name }, leaves: withDays });
}

module.exports = { today, punchIn, breakStart, breakEnd, punchOut, calendar, attendanceDay, leaveBalance, myLeaves };
