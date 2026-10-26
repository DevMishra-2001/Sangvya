import { and, asc, desc, eq, getTableColumns, gte, lte, ne } from "drizzle-orm";
import { db } from "../../config/db.js";
import { can } from "../../utils/can.js";
import { employees, leaveRequests, users } from "../../db/schema.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { isSunday } from "../../utils/workday.js";
import { findEmployeeById, getEmployeeById } from "../employees/employees.service.js";
import { findHolidayByDate } from "../holidays/holidays.service.js";
import { balanceError } from "./leaveBalance.service.js";
import type { ApplyLeaveInput, LeaveStatusInput } from "./leaves.schema.js";

// Leave rows with the employee's name, as every leave list shows them
const withEmployeeName = { ...getTableColumns(leaveRequests), employee_name: employees.name };

function leavesWhere(...conditions: Parameters<typeof and>) {
  return db
    .select(withEmployeeName)
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employee_id))
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
        includeRejected ? undefined : ne(leaveRequests.status, "rejected"),
      ),
    )
    .orderBy(asc(leaveRequests.from_date));
}

// An employee's leaves touching [from, to], with who reviewed them
export function findLeavesForEmployeeInRange(companyId: number, employeeId: number, from: string, to: string) {
  return db
    .select({ ...withEmployeeName, reviewed_by_name: users.name })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employee_id))
    .leftJoin(users, eq(users.id, leaveRequests.reviewed_by))
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

// Type-agnostic rules: not on a day that's already off, no double booking.
async function leaveRuleError(companyId: number, employeeId: number, fromDate: string, toDate: string) {
  const singleDay = fromDate === toDate;
  const offDay = singleDay && (isSunday(fromDate) || Boolean(await findHolidayByDate(companyId, fromDate)));
  // Comp off is earned by working a Sunday/holiday and then taken on a working
  // day like any other leave (balance checked in balanceError).
  if (offDay) return "This day is already off (Sunday/holiday) — no leave needed";

  const overlapping = await findOverlappingLeaves(companyId, employeeId, fromDate, toDate);
  if (overlapping.length > 0) return "You already have a leave request covering these dates";
  return null;
}

// Everyone can list — without "leave.viewAll" only their own leaves
export async function listLeaves(companyId: number, user: Express.AuthUser) {
  if (can(user, "leave.viewAll")) {
    return { leaves: await leavesWhere(eq(leaveRequests.company_id, companyId)) };
  }
  if (!user.employeeId) return { leaves: [] };
  return {
    leaves: await leavesWhere(eq(leaveRequests.company_id, companyId), eq(leaveRequests.employee_id, user.employeeId)),
  };
}

export async function applyLeave(companyId: number, user: Express.AuthUser, input: ApplyLeaveInput) {
  const { fromDate, toDate, reason, leaveType } = input;
  const employeeId = input.employeeId || user.employeeId;

  if (!employeeId) throw new BadRequestError("Your login isn't linked to an employee record — ask HR to link it");
  if (employeeId !== user.employeeId && !can(user, "leave.applyForOthers")) {
    throw new ForbiddenError("You can only apply leave for yourself");
  }
  if (new Date(toDate) < new Date(fromDate)) throw new BadRequestError("toDate can't be before fromDate");
  const employee = await getEmployeeById(companyId, employeeId);

  const from = fromDate.slice(0, 10);
  const to = toDate.slice(0, 10);
  const error = (await leaveRuleError(companyId, employeeId, from, to)) || (await balanceError(companyId, employee, leaveType, from, to));
  if (error) throw new BadRequestError(error);

  const [leave] = await db
    .insert(leaveRequests)
    .values({ company_id: companyId, employee_id: employeeId, from_date: from, to_date: to, reason: reason ?? null, leave_type: leaveType })
    .returning();
  return { leave: { ...leave, employee_name: employee.name } };
}

// The employee's reporting manager decides. If they have no manager set,
// HR / superadmin step in so the request isn't stuck. Nobody — not even a
// superadmin — decides their own leave.
export async function decideLeave(companyId: number, user: Express.AuthUser, id: number, { status }: LeaveStatusInput) {
  const [existing] = await leavesWhere(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, id));
  if (!existing) throw new NotFoundError("Leave request not found");
  if (user.employeeId && existing.employee_id === user.employeeId) {
    throw new ForbiddenError("You can't approve or reject your own leave");
  }
  if (existing.status !== "pending") throw new BadRequestError(`This leave is already ${existing.status}`);

  const employee = await findEmployeeById(companyId, existing.employee_id);
  const isTheirManager = Boolean(user.employeeId) && employee?.manager_id === user.employeeId;
  const canStepIn = !employee?.manager_id && can(user, "leave.approveUnassigned");
  if (!isTheirManager && !canStepIn) {
    throw new ForbiddenError(
      employee?.manager_id ? "Only this employee's reporting manager can approve or reject their leave" : "You can't approve this leave",
    );
  }

  const [leave] = await db
    .update(leaveRequests)
    .set({ status, reviewed_by: user.id, reviewed_at: new Date() })
    .where(and(eq(leaveRequests.company_id, companyId), eq(leaveRequests.id, id)))
    .returning();
  return { leave: { ...leave, employee_name: existing.employee_name } };
}
