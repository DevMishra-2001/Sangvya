import { and, asc, desc, eq, getTableColumns, gte, inArray, lte, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { can } from "../../utils/can.js";
import { employees, leaveRequests, users } from "../../db/schema.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { audit } from "../../utils/audit.js";
import { workCalendar } from "../companies/workCalendar.js";
import { notifyLeaveCancelled, notifyLeaveDecided, notifyLeaveRequested } from "./leaveNotify.js";
import { approverOf, canDecideFor } from "../employees/approver.js";
import { findEmployeeById, getEmployeeById } from "../employees/employees.service.js";
import { findDayOffHoliday } from "../holidays/holidays.service.js";
import { balanceError, getBalances } from "./leaveBalance.service.js";
import type { ApplyLeaveInput, LeaveStatusInput } from "./leaves.schema.js";

// Leave rows with the employee's name and who decides them (their reporting
// manager), as every leave list shows them
const manager = alias(employees, "manager");
const reviewer = alias(users, "reviewer");
const withEmployeeName = {
  ...getTableColumns(leaveRequests),
  employee_name: employees.name,
  reviewed_by_name: reviewer.name,
  manager_id: employees.manager_id,
  manager_name: manager.name,
  manager_status: manager.status,
};

type LeaveRow = Awaited<ReturnType<typeof leavesWhere>>[number];

// Who decides a request: the employee's reporting manager; HR (leave.approveUnassigned)
// when there's no manager, or the manager has left the company (see employees/approver.ts)
const canDecide = (user: Express.AuthUser, row: Pick<LeaveRow, "employee_id" | "manager_id" | "manager_status">) =>
  canDecideFor(user, row, "leave.approveUnassigned");

// What the browser gets: no internal manager status, plus who decides and whether I can
function present(user: Express.AuthUser, { manager_status: _status, ...row }: LeaveRow) {
  return { ...row, approver: approverOf({ ...row, manager_status: _status }), can_decide: canDecide(user, { ...row, manager_status: _status }) };
}

function leavesWhere(...conditions: Parameters<typeof and>) {
  return db
    .select(withEmployeeName)
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employee_id))
    .leftJoin(manager, eq(manager.id, employees.manager_id))
    .leftJoin(reviewer, eq(reviewer.id, leaveRequests.reviewed_by))
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.created_at));
}

// Pending/approved requests of an employee touching [from, to] — used both to
// block double-booking and to paint the calendar.
export function findOverlappingLeaves(
  companyId: number,
  employeeId: number,
  from: string,
  to: string,
  { includeRejected = false } = {},
) {
  return db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.company_id, companyId),
        eq(leaveRequests.employee_id, employeeId),
        lte(leaveRequests.from_date, to),
        gte(leaveRequests.to_date, from),
        // Cancelled leaves are gone; rejected ones still show on the calendar
        inArray(leaveRequests.status, includeRejected ? ["pending", "approved", "rejected"] : ["pending", "approved"]),
      ),
    )
    .orderBy(asc(leaveRequests.from_date));
}

// An employee's leaves touching [from, to], with who reviewed them
export function findLeavesForEmployeeInRange(companyId: number, employeeId: number, from: string, to: string) {
  return db
    .select(withEmployeeName)
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employee_id))
    .leftJoin(manager, eq(manager.id, employees.manager_id))
    .leftJoin(reviewer, eq(reviewer.id, leaveRequests.reviewed_by))
    .where(
      and(
        eq(leaveRequests.company_id, companyId),
        eq(leaveRequests.employee_id, employeeId),
        lte(leaveRequests.from_date, to),
        gte(leaveRequests.to_date, from),
      ),
    )
    .orderBy(asc(leaveRequests.from_date));
}

// Type-agnostic rules: not on a day that's already off, no double booking
// (two half days on the same day are fine if they're different halves).
async function leaveRuleError(companyId: number, employeeId: number, fromDate: string, toDate: string, halfDay: string | null) {
  const singleDay = fromDate === toDate;
  if (halfDay && !singleDay) return "A half-day leave is for a single day";
  const cal = await workCalendar(companyId);
  const offDay = singleDay && (cal.isWeeklyOff(fromDate) || Boolean(await findDayOffHoliday(companyId, fromDate)));
  // Comp off is earned by working a weekly off / holiday and then taken on a
  // working day like any other leave (balance checked in balanceError).
  if (offDay) return "This day is already off (weekly off / holiday) — no leave needed";

  const overlapping = (await findOverlappingLeaves(companyId, employeeId, fromDate, toDate)).filter(
    (l) => !(halfDay && l.half_day && l.half_day !== halfDay && l.from_date === fromDate && l.to_date === toDate),
  );
  if (overlapping.length > 0) return "You already have a leave request covering these dates";
  return null;
}

// Everyone can list. With "leave.viewAll": every request; otherwise my own
// plus my team's (people whose "Reports to" is me), so I can decide theirs.
export async function listLeaves(companyId: number, user: Express.AuthUser) {
  if (can(user, "leave.viewAll")) {
    return { leaves: (await leavesWhere(eq(leaveRequests.company_id, companyId))).map((l) => present(user, l)) };
  }
  if (!user.employeeId) return { leaves: [] };
  const rows = await leavesWhere(
    eq(leaveRequests.company_id, companyId),
    or(eq(leaveRequests.employee_id, user.employeeId), eq(employees.manager_id, user.employeeId)),
  );
  return { leaves: rows.map((l) => present(user, l)) };
}

export async function applyLeave(companyId: number, user: Express.AuthUser, input: ApplyLeaveInput) {
  const { fromDate, toDate, reason, leaveType } = input;
  const halfDay = input.halfDay ?? null;
  const employeeId = input.employeeId || user.employeeId;

  if (!employeeId) throw new BadRequestError("Your login isn't linked to an employee record — ask HR to link it");
  if (employeeId !== user.employeeId && !can(user, "leave.applyForOthers")) {
    throw new ForbiddenError("You can only apply leave for yourself");
  }
  if (new Date(toDate) < new Date(fromDate)) throw new BadRequestError("toDate can't be before fromDate");
  const employee = await getEmployeeById(companyId, employeeId);

  const from = fromDate.slice(0, 10);
  const to = toDate.slice(0, 10);
  const error = (await leaveRuleError(companyId, employeeId, from, to, halfDay)) || (await balanceError(companyId, employee, leaveType, from, to, halfDay));
  if (error) throw new BadRequestError(error);

  const [leave] = await db
    .insert(leaveRequests)
    .values({ company_id: companyId, employee_id: employeeId, from_date: from, to_date: to, reason: reason ?? null, leave_type: leaveType, half_day: halfDay })
    .returning();
  const [row] = await leavesWhere(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, leave.id));
  void notifyLeaveRequested(row, user.id);
  return { leave: present(user, row) };
}

// The employee's reporting manager decides. If they have no manager set (or
// the manager has left), HR / superadmin step in so the request isn't stuck. Nobody — not even a
// superadmin — decides their own leave.
export async function decideLeave(companyId: number, user: Express.AuthUser, id: number, { status, note }: LeaveStatusInput) {
  const [existing] = await leavesWhere(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, id));
  if (!existing) throw new NotFoundError("Leave request not found");
  if (user.employeeId && existing.employee_id === user.employeeId) {
    throw new ForbiddenError("You can't approve or reject your own leave");
  }
  if (existing.status !== "pending") throw new BadRequestError(`This leave is already ${existing.status}`);

  if (!canDecide(user, existing)) {
    throw new ForbiddenError(
      approverOf(existing) === "manager"
        ? `Only ${existing.employee_name}'s reporting manager (${existing.manager_name}) can approve or reject their leave`
        : "You can't approve this leave",
    );
  }

  const [leave] = await db
    .update(leaveRequests)
    .set({ status, review_note: note ?? null, reviewed_by: user.id, reviewed_at: new Date() })
    .where(and(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, id)))
    .returning({ id: leaveRequests.id });
  const [row] = await leavesWhere(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, leave.id));
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, user.id));
  void notifyLeaveDecided(row, status as "approved" | "rejected", { id: user.id, name: me?.name ?? "Your manager" }, note ?? null);
  return { leave: present(user, row) };
}

// POST /api/leaves/:id/cancel — the employee withdraws a pending request or
// cancels an approved leave that hasn't started; HR (leave.applyForOthers) can
// cancel any pending / approved leave. The days go back to the balance.
export async function cancelLeave(companyId: number, user: Express.AuthUser, id: number) {
  const [existing] = await leavesWhere(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, id));
  if (!existing) throw new NotFoundError("Leave request not found");
  if (existing.status !== "pending" && existing.status !== "approved") throw new BadRequestError(`This leave is already ${existing.status}`);

  const isMine = Boolean(user.employeeId) && existing.employee_id === user.employeeId;
  const isHr = can(user, "leave.applyForOthers");
  if (!isMine && !isHr) throw new ForbiddenError("You can only cancel your own leave");
  if (!isHr && existing.status === "approved" && existing.from_date <= localDate()) {
    throw new BadRequestError("This leave has already started — ask HR to cancel it");
  }

  await db
    .update(leaveRequests)
    .set({ status: "cancelled", cancelled_by: user.id, cancelled_at: new Date() })
    .where(and(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, id)));
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, user.id));
  void notifyLeaveCancelled(existing, existing.status === "approved", { id: user.id, name: me?.name ?? "someone", employeeId: user.employeeId });
  audit(user, {
    companyId,
    action: "leave.cancelled",
    target: ["employee", existing.employee_id],
    summary: `${isMine && existing.status === "pending" ? "Withdrew" : "Cancelled"} ${isMine ? "their" : `${existing.employee_name}'s`} ${existing.status} leave ${existing.from_date}${existing.to_date !== existing.from_date ? ` – ${existing.to_date}` : ""}`,
  });
  const [row] = await leavesWhere(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, id));
  return { leave: present(user, row) };
}

// GET /api/leaves/balances — everyone's balances today (HR: leave.viewAll)
export async function allBalances(companyId: number) {
  const people = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), ne(employees.status, "exited")))
    .orderBy(asc(employees.name));
  const today = localDate();
  const rows = [];
  for (const { id } of people) {
    const employee = await getEmployeeById(companyId, id);
    const b = await getBalances(companyId, employee, today);
    rows.push({
      employee: { id: employee.id, name: employee.name, photo_url: employee.photo_url, department: employee.department, join_date: employee.join_date },
      balances: b,
    });
  }
  return { leaveYear: rows[0]?.balances.leaveYear ?? null, employees: rows };
}
