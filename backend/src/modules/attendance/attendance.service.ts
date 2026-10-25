// Attendance rows: HR marking (this module's routes) plus the punch in/out
// data layer used by the self-service module (/api/me) and the day-close job.
import { and, asc, between, desc, eq, getTableColumns, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { attendance, attendanceBreaks, attendancePunches, employees } from "../../db/schema.js";
import { getEmployeeById } from "../employees/employees.service.js";
import type { MarkAttendanceInput } from "./attendance.schema.js";

export type AttendanceRecord = typeof attendance.$inferSelect;
export type AttendanceBreak = typeof attendanceBreaks.$inferSelect;
export type AttendancePunch = typeof attendancePunches.$inferSelect;

export interface PunchDetails {
  location: string | null;
  remarks: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  photoUrl: string | null;
}

// ---- HR marking ----

// Upsert: marking the same employee/date twice updates the status instead of
// creating a duplicate row (UNIQUE (employee_id, date)).
export async function markAttendance(companyId: number, { employeeId, date, status }: MarkAttendanceInput) {
  await getEmployeeById(companyId, employeeId); // must be this company's employee
  const [record] = await db
    .insert(attendance)
    .values({ company_id: companyId, employee_id: employeeId, date, status })
    .onConflictDoUpdate({ target: [attendance.employee_id, attendance.date], set: { status: sql`excluded.status` } })
    .returning();
  return { attendance: record };
}

export async function attendanceByDate(companyId: number, date: string) {
  const rows = await db
    .select({ ...getTableColumns(attendance), employee_name: employees.name })
    .from(attendance)
    .innerJoin(employees, eq(employees.id, attendance.employee_id))
    .where(and(eq(attendance.company_id, companyId), eq(attendance.date, date)));
  return { attendance: rows };
}

export function findAttendanceInRange(companyId: number, employeeId: number, from: string, to: string) {
  return db
    .select()
    .from(attendance)
    .where(and(eq(attendance.company_id, companyId), eq(attendance.employee_id, employeeId), between(attendance.date, from, to)))
    .orderBy(asc(attendance.date));
}

// ---- Self-service punch in/out ----

export async function findAttendance(companyId: number, employeeId: number, date: string): Promise<AttendanceRecord | undefined> {
  const [record] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.company_id, companyId), eq(attendance.employee_id, employeeId), eq(attendance.date, date)));
  return record;
}

// The day still running (punched in, not out). Looks back one day so a
// shift that crosses midnight can still be closed.
export async function findOpenAttendance(companyId: number, employeeId: number, today: string): Promise<AttendanceRecord | undefined> {
  const [record] = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.company_id, companyId),
        eq(attendance.employee_id, employeeId),
        isNotNull(attendance.punch_in),
        isNull(attendance.punch_out),
        sql`${attendance.date} >= ${today}::date - 1`,
      ),
    )
    .orderBy(desc(attendance.date))
    .limit(1);
  return record;
}

// Creates the day's row, or fills punch_in on a row HR already marked.
// Returns undefined if the day was already punched in.
export async function insertPunchIn(companyId: number, employeeId: number, date: string, at: Date, { location, remarks }: PunchDetails) {
  const [record] = await db
    .insert(attendance)
    .values({
      company_id: companyId,
      employee_id: employeeId,
      date,
      status: "present",
      punch_in: at,
      punch_in_location: location,
      punch_in_remarks: remarks,
    })
    .onConflictDoUpdate({
      target: [attendance.employee_id, attendance.date],
      set: {
        punch_in: sql`excluded.punch_in`,
        status: "present",
        punch_in_location: sql`excluded.punch_in_location`,
        punch_in_remarks: sql`excluded.punch_in_remarks`,
      },
      setWhere: isNull(attendance.punch_in),
    })
    .returning();
  return record;
}

// Punching in again after a punch-out the same day: the time away becomes a
// break (last punch-out → now) and the day is open again. The row is locked,
// so two quick clicks can't create two breaks. Undefined if it wasn't punched out.
export function resumeAttendance(companyId: number, id: number, at: Date) {
  return db.transaction(async (tx) => {
    const [old] = await tx
      .select({ id: attendance.id, punch_out: attendance.punch_out })
      .from(attendance)
      .where(and(eq(attendance.company_id, companyId), eq(attendance.id, id), isNotNull(attendance.punch_out)))
      .for("update");
    if (!old?.punch_out) return undefined;

    await tx.insert(attendanceBreaks).values({ company_id: companyId, attendance_id: old.id, break_start: old.punch_out, break_end: at });
    const [record] = await tx
      .update(attendance)
      .set({ punch_out: null, punch_out_location: null, punch_out_remarks: null })
      .where(eq(attendance.id, old.id))
      .returning();
    return record;
  });
}

// Undefined if it was already punched out
export async function updatePunchOut(companyId: number, id: number, at: Date, { location, remarks }: PunchDetails) {
  const [record] = await db
    .update(attendance)
    .set({ punch_out: at, punch_out_location: location, punch_out_remarks: remarks })
    .where(and(eq(attendance.company_id, companyId), eq(attendance.id, id), isNull(attendance.punch_out)))
    .returning();
  return record;
}

// One entry in the punch log (every punch in / out keeps its own location + remarks)
export async function logPunch(companyId: number, attendanceId: number, kind: "in" | "out", at: Date, d: PunchDetails) {
  await db.insert(attendancePunches).values({
    company_id: companyId,
    attendance_id: attendanceId,
    kind,
    punched_at: at,
    location: d.location,
    remarks: d.remarks,
    latitude: d.latitude,
    longitude: d.longitude,
    accuracy_m: d.accuracyM,
    photo_url: d.photoUrl,
  });
}

export async function startBreak(companyId: number, attendanceId: number, at: Date) {
  await db.insert(attendanceBreaks).values({ company_id: companyId, attendance_id: attendanceId, break_start: at });
}

// Closes the running break (if any) for a day
export async function endBreak(companyId: number, attendanceId: number, at: Date) {
  const [ended] = await db
    .update(attendanceBreaks)
    .set({ break_end: at })
    .where(
      and(eq(attendanceBreaks.company_id, companyId), eq(attendanceBreaks.attendance_id, attendanceId), isNull(attendanceBreaks.break_end)),
    )
    .returning();
  return ended;
}

function groupBy<T, K extends keyof T>(rows: T[], key: K): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) (grouped[String(row[key])] ||= []).push(row);
  return grouped;
}

// Breaks for several days at once: { attendanceId: [breaks] }
export async function breaksFor(companyId: number, attendanceIds: number[]) {
  if (attendanceIds.length === 0) return {};
  const rows = await db
    .select()
    .from(attendanceBreaks)
    .where(and(eq(attendanceBreaks.company_id, companyId), inArray(attendanceBreaks.attendance_id, attendanceIds)))
    .orderBy(asc(attendanceBreaks.break_start));
  return groupBy(rows, "attendance_id");
}

// Punches for several days at once, in time order: { attendanceId: [punches] }
export async function punchesFor(companyId: number, attendanceIds: number[]) {
  if (attendanceIds.length === 0) return {};
  const rows = await db
    .select()
    .from(attendancePunches)
    .where(and(eq(attendancePunches.company_id, companyId), inArray(attendancePunches.attendance_id, attendanceIds)))
    .orderBy(asc(attendancePunches.punched_at), asc(attendancePunches.kind));
  return groupBy(rows, "attendance_id");
}

// ---- End-of-day check (jobs/dayClose.job.ts) ----

// Past days whose end-of-day check (manager email) hasn't run yet
export function findDaysToClose(today: string) {
  return db
    .select()
    .from(attendance)
    .where(and(lt(attendance.date, today), isNotNull(attendance.punch_in), isNull(attendance.day_closed_at)))
    .orderBy(asc(attendance.date))
    .limit(200);
}

export async function markDayClosed(id: number) {
  await db.update(attendance).set({ day_closed_at: sql`now()` }).where(eq(attendance.id, id));
}
