// The logged-in employee's own attendance: punch in/out, breaks, the month
// calendar (attendance + holidays + leaves) and leave balances.
import { BadRequestError, ConflictError } from "../../utils/httpErrors.js";
import { isSunday, localDate, MAX_BREAK_MINUTES, monthBounds, REQUIRED_MINUTES, summarize } from "../../utils/workday.js";
import {
  breaksFor,
  endBreak,
  findAttendance,
  findAttendanceInRange,
  findOpenAttendance,
  insertPunchIn,
  logPunch,
  punchesFor,
  resumeAttendance,
  startBreak,
  updatePunchOut,
  type AttendanceBreak,
  type AttendancePunch,
  type AttendanceRecord,
  type PunchDetails,
} from "../attendance/attendance.service.js";
import { findEmployeeById, getEmployeeById, setEmployeePhoto } from "../employees/employees.service.js";
import { findHolidayByDate, findHolidaysInRange } from "../holidays/holidays.service.js";
import { countLeaveDays, getBalances } from "../leaves/leaveBalance.service.js";
import { findLeavesForEmployeeInRange, findOverlappingLeaves } from "../leaves/leaves.service.js";
import { dayFlags, LOCATIONS, primaryStatus } from "./attendanceStatus.js";
import type { PunchInput } from "./self.schema.js";

const RULES = { requiredMinutes: REQUIRED_MINUTES, maxBreakMinutes: MAX_BREAK_MINUTES };

// Who is acting: the logged-in user's company + linked employee
export interface Self {
  companyId: number;
  employeeId: number;
}

// GPS + selfie for one punch (null when not captured)
const geoOf = (p: AttendancePunch) =>
  p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude, accuracy: p.accuracy_m } : null;

type Session = {
  in: Date;
  inLocation: string | null;
  inRemarks: string | null;
  inGeo: ReturnType<typeof geoOf>;
  inPhoto: string | null;
  out: Date | null;
  outLocation: string | null;
  outRemarks: string | null;
  outGeo: ReturnType<typeof geoOf>;
  outPhoto: string | null;
};

// Punch log → work sessions: [{ in, inLocation, inRemarks, inGeo, inPhoto, out, out… }]
function toSessions(punches: AttendancePunch[]) {
  const sessions: Session[] = [];
  for (const p of punches) {
    if (p.kind === "in") {
      sessions.push({
        in: p.punched_at,
        inLocation: p.location,
        inRemarks: p.remarks,
        inGeo: geoOf(p),
        inPhoto: p.photo_url,
        out: null,
        outLocation: null,
        outRemarks: null,
        outGeo: null,
        outPhoto: null,
      });
    } else if (sessions.length && !sessions[sessions.length - 1].out) {
      Object.assign(sessions[sessions.length - 1], {
        out: p.punched_at,
        outLocation: p.location,
        outRemarks: p.remarks,
        outGeo: geoOf(p),
        outPhoto: p.photo_url,
      });
    }
  }
  return sessions;
}

// One attendance row (+ its breaks and punches) shaped for the frontend
function dayPayload(record: AttendanceRecord, breaks: AttendanceBreak[] = [], punches: AttendancePunch[] = [], now = new Date()) {
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

async function withBreaks(companyId: number, record: AttendanceRecord | undefined) {
  if (!record) return null;
  const breaks = (await breaksFor(companyId, [record.id]))[record.id] || [];
  const punches = (await punchesFor(companyId, [record.id]))[record.id] || [];
  return dayPayload(record, breaks, punches);
}

// The day to show/act on: a still-open shift if there is one, otherwise today's row.
async function currentRecord({ companyId, employeeId }: Self) {
  const today = localDate();
  return (await findOpenAttendance(companyId, employeeId, today)) || (await findAttendance(companyId, employeeId, today));
}

const punchDetails = (input: PunchInput): PunchDetails => ({
  location: input.location || null,
  remarks: input.remarks?.trim() || null,
  latitude: input.latitude ?? null,
  longitude: input.longitude ?? null,
  accuracyM: input.accuracy != null ? Math.round(input.accuracy) : null,
  photoUrl: input.photoUrl ?? null,
});

// GET /api/me/today
export async function today(self: Self) {
  const date = localDate();
  const record = await currentRecord(self);
  const holiday = await findHolidayByDate(self.companyId, date);
  return { date, isSunday: isSunday(date), holiday: holiday || null, day: await withBreaks(self.companyId, record), rules: RULES };
}

// First punch of the day starts it. Punching in again after a punch-out the same
// day ends the "away" time: last punch-out → now is recorded as a break.
export async function punchIn(self: Self, input: PunchInput) {
  const { companyId, employeeId } = self;
  const date = localDate();
  if (await findOpenAttendance(companyId, employeeId, date)) {
    throw new BadRequestError("You're already punched in — punch out first");
  }

  // The time is always the server's "now" — employees can't pick it
  const now = new Date();
  const details = punchDetails(input);
  const existing = await findAttendance(companyId, employeeId, date);
  const record = existing?.punch_in
    ? await resumeAttendance(companyId, existing.id, now)
    : await insertPunchIn(companyId, employeeId, date, now, details);
  if (!record) throw new ConflictError("Your attendance just changed — please refresh");

  await logPunch(companyId, record.id, "in", now, details);
  return { day: await withBreaks(companyId, record) };
}

// Kept for API compatibility; the app now treats punch-out → punch-in as the break.
export async function breakStart({ companyId, employeeId }: Self) {
  const open = await findOpenAttendance(companyId, employeeId, localDate());
  if (!open) throw new BadRequestError("Punch in first");

  const day = await withBreaks(companyId, open);
  if (day?.onBreak) throw new BadRequestError("You're already on a break");

  await startBreak(companyId, open.id, new Date());
  return { day: await withBreaks(companyId, open) };
}

export async function breakEnd({ companyId, employeeId }: Self) {
  const open = await findOpenAttendance(companyId, employeeId, localDate());
  if (!open) throw new BadRequestError("Punch in first");

  if (!(await endBreak(companyId, open.id, new Date()))) throw new BadRequestError("You're not on a break");
  return { day: await withBreaks(companyId, open) };
}

// Stops the work clock. If the employee punches in again today, the time in
// between becomes a break; if not, the day ends here. (The manager alert runs
// after the day is over — see jobs/dayClose.job.ts.)
export async function punchOut({ companyId, employeeId }: Self, input: PunchInput) {
  const open = await findOpenAttendance(companyId, employeeId, localDate());
  if (!open) throw new BadRequestError("You're not punched in");

  const now = new Date();
  const details = punchDetails(input);
  await endBreak(companyId, open.id, now);
  const record = await updatePunchOut(companyId, open.id, now, details);
  if (!record) throw new ConflictError("Your attendance just changed — please refresh");

  await logPunch(companyId, record.id, "out", now, details);
  return { day: await withBreaks(companyId, record) };
}

// GET /api/me/calendar?month=YYYY-MM
export async function calendar({ companyId, employeeId }: Self, monthParam?: string) {
  const month = monthParam || localDate().slice(0, 7);
  const { from, to } = monthBounds(month);

  const records = await findAttendanceInRange(companyId, employeeId, from, to);
  const ids = records.map((r) => r.id);
  const breaks = await breaksFor(companyId, ids);
  const punches = await punchesFor(companyId, ids);
  const holidays = await findHolidaysInRange(companyId, from, to);
  const leaves = await findOverlappingLeaves(companyId, employeeId, from, to, { includeRejected: true });
  const employee = await getEmployeeById(companyId, employeeId);
  const now = new Date();

  return {
    month,
    today: localDate(),
    employee: { id: employee.id, name: employee.name },
    days: records.map((r) => dayPayload(r, breaks[r.id] || [], punches[r.id] || [], now)),
    holidays,
    leaves,
    balances: await getBalances(companyId, employee, localDate()),
    rules: RULES,
  };
}

// GET /api/me/attendance?date=YYYY-MM-DD — one day for the Attendance tab:
// the record, its status flags (legend counts) and the main status.
export async function attendanceDay({ companyId, employeeId }: Self, dateParam?: string) {
  const todayDate = localDate();
  const date = dateParam || todayDate;
  const employee = await getEmployeeById(companyId, employeeId);
  const day = await withBreaks(companyId, await findAttendance(companyId, employeeId, date));
  const holiday = await findHolidayByDate(companyId, date);
  const leaves = await findOverlappingLeaves(companyId, employeeId, date, date);
  const flags = dayFlags({ date, today: todayDate, day, holiday, leaves });

  return {
    date,
    today: todayDate,
    employee: { id: employee.id, name: employee.name, code: employee.employee_code },
    day,
    holiday: holiday || null,
    leaves,
    flags,
    status: primaryStatus(flags),
    locations: LOCATIONS,
    rules: RULES,
  };
}

// GET /api/me/leave-balance — CL / SL / OL / EL for today
export async function leaveBalance({ companyId, employeeId }: Self) {
  const employee = await getEmployeeById(companyId, employeeId);
  return { balances: await getBalances(companyId, employee, localDate()) };
}

// GET /api/me/leaves?month=YYYY-MM — this month's leave requests with day counts
export async function myLeaves({ companyId, employeeId }: Self, monthParam?: string) {
  const month = monthParam || localDate().slice(0, 7);
  const { from, to } = monthBounds(month);
  const employee = await getEmployeeById(companyId, employeeId);
  const leaves = await findLeavesForEmployeeInRange(companyId, employeeId, from, to);

  const withDays = [];
  for (const l of leaves) {
    // Days inside this month only (a leave may run into the next month)
    const start = l.from_date > from ? l.from_date : from;
    const end = l.to_date < to ? l.to_date : to;
    withDays.push({ ...l, days: await countLeaveDays(companyId, start, end), monthFrom: start, monthTo: end });
  }
  return { month, employee: { id: employee.id, name: employee.name }, leaves: withDays };
}

// GET /api/me/profile — my employee record for the header's profile panel
export async function profile({ companyId, employeeId }: Self) {
  const employee = await getEmployeeById(companyId, employeeId);
  const manager = employee.manager_id ? await findEmployeeById(companyId, employee.manager_id) : undefined;
  return {
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      code: employee.employee_code,
      designation: employee.designation,
      department: employee.department,
      joinDate: employee.join_date,
      dateOfBirth: employee.date_of_birth,
      photoUrl: employee.photo_url,
      manager: manager ? { id: manager.id, name: manager.name } : null,
    },
  };
}

// PUT /api/me/photo — change (or remove) my own profile photo
export async function updatePhoto({ companyId, employeeId }: Self, photoUrl: string | null) {
  await setEmployeePhoto(companyId, employeeId, photoUrl);
  return profile({ companyId, employeeId });
}
