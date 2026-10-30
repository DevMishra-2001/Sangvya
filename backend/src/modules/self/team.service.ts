// GET /api/me/team — a manager's team (people whose "Reports to" is me): today's attendance for each, who's on leave, and leave requests waiting for me.
import { and, count, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { attendance, attendanceCorrections, departments, designations, employees, leaveRequests } from "../../db/schema.js";
import { localDate } from "../../utils/workday.js";
import { disabledModules } from "../pages/access.service.js";

// How many people report to this employee (for the "My team" menu item)
export async function teamSize(companyId: number | null, employeeId: number | null) {
  if (!companyId || !employeeId) return 0;
  const [{ n }] = await db
    .select({ n: count() })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), eq(employees.manager_id, employeeId), ne(employees.status, "exited")));
  return n;
}

export async function myTeam(companyId: number, employeeId: number) {
  const today = localDate();
  const off = await disabledModules(companyId);

  const members = await db
    .select({
      id: employees.id,
      name: employees.name,
      photo_url: employees.photo_url,
      designation: designations.name,
      department: departments.name,
      status: employees.status,
      exit_date: employees.exit_date,
    })
    .from(employees)
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .leftJoin(departments, eq(departments.id, employees.department_id))
    .where(and(eq(employees.company_id, companyId), eq(employees.manager_id, employeeId), ne(employees.status, "exited")))
    .orderBy(employees.name);
  const ids = members.map((m) => m.id);
  if (!ids.length) return { date: today, members: [], pendingLeaves: off.has("leave") ? null : 0, pendingCorrections: off.has("attendance") ? null : 0 };

  const attendanceOn = !off.has("attendance");
  const leaveOn = !off.has("leave");

  const [days, away, pending, corrections] = await Promise.all([
    attendanceOn
      ? db
          .select({ employee_id: attendance.employee_id, status: attendance.status, punch_in: attendance.punch_in, punch_out: attendance.punch_out, late: sql<boolean>`coalesce(${attendance.late_minutes}, 0) > 0` })
          .from(attendance)
          .where(and(eq(attendance.company_id, companyId), eq(attendance.date, today), inArray(attendance.employee_id, ids)))
      : Promise.resolve([]),
    leaveOn
      ? db
          .select({ employee_id: leaveRequests.employee_id, leave_type: leaveRequests.leave_type, to_date: leaveRequests.to_date })
          .from(leaveRequests)
          .where(
            and(
              eq(leaveRequests.company_id, companyId),
              eq(leaveRequests.status, "approved"),
              lte(leaveRequests.from_date, today),
              gte(leaveRequests.to_date, today),
              inArray(leaveRequests.employee_id, ids),
            ),
          )
      : Promise.resolve([]),
    leaveOn
      ? db
          .select({ employee_id: leaveRequests.employee_id, n: count() })
          .from(leaveRequests)
          .where(and(eq(leaveRequests.company_id, companyId), eq(leaveRequests.status, "pending"), inArray(leaveRequests.employee_id, ids)))
          .groupBy(leaveRequests.employee_id)
      : Promise.resolve([]),
    attendanceOn
      ? db
          .select({ n: count() })
          .from(attendanceCorrections)
          .where(and(eq(attendanceCorrections.company_id, companyId), eq(attendanceCorrections.status, "pending"), inArray(attendanceCorrections.employee_id, ids)))
      : Promise.resolve(null),
  ]);

  const dayOf = new Map(days.map((d) => [d.employee_id, d]));
  const leaveOf = new Map(away.map((l) => [l.employee_id, l]));
  const pendingOf = new Map(pending.map((p) => [p.employee_id, p.n]));

  return {
    date: today,
    members: members.map((m) => {
      const day = dayOf.get(m.id);
      const leave = leaveOf.get(m.id);
      // in | out (punched out) | late | leave | not_in
      const today_ = !attendanceOn
        ? null
        : day && (day.status === "present" || day.status === "half")
          ? { state: day.punch_out ? "out" : day.late ? "late" : "in", punch_in: day.punch_in, punch_out: day.punch_out }
          : leave
            ? { state: "leave", punch_in: null, punch_out: null }
            : { state: "not_in", punch_in: null, punch_out: null };
      return {
        ...m,
        today: today_,
        on_leave: leave ? { leave_type: leave.leave_type, until: leave.to_date } : null,
        pending_leaves: leaveOn ? (pendingOf.get(m.id) ?? 0) : null,
      };
    }),
    pendingLeaves: leaveOn ? pending.reduce((s, p) => s + p.n, 0) : null,
    pendingCorrections: corrections ? corrections[0].n : null,
  };
}
