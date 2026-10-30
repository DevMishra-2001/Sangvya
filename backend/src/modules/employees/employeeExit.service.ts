// Leaving: notice until the last working day, then exited (login blocked, not billed)
import { and, eq, lt } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companyMembers, employees, roles, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ForbiddenError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { revokeAllSessionsForUser } from "../auth/session.service.js";
import { syncSubscriptionQuantity } from "../billing/billing.service.js";
import type { ExitInput } from "./employees.schema.js";
import { getEmployeeById, type Employee } from "./employees.service.js";

const REASON_LABEL: Record<string, string> = {
  resigned: "Resigned",
  terminated: "Terminated",
  retired: "Retired",
  contract_end: "Contract ended",
  absconded: "Absconded",
  other: "Other",
};

// Nobody processes their own exit, or the exit of someone ranked above them
async function assertCanAct(actor: Express.AuthUser, employee: Employee) {
  if (employee.id === actor.employeeId) throw new BadRequestError("You can't process your own exit");
  if (actor.isSuperadmin || !employee.role_id) return;
  const [r] = await db.select({ level: roles.level }).from(roles).where(eq(roles.id, employee.role_id));
  if (r && r.level > actor.level) throw new ForbiddenError("You can't process the exit of someone with a higher role");
}

// Block their login (in this company) and end their sessions
async function blockLogin(companyId: number, employeeId: number) {
  const logins = await db
    .select({ id: companyMembers.user_id })
    .from(companyMembers)
    .where(and(eq(companyMembers.company_id, companyId), eq(companyMembers.employee_id, employeeId)));
  for (const { id } of logins) {
    await db.update(users).set({ is_blocked: true }).where(eq(users.id, id));
    await revokeAllSessionsForUser(id);
  }
}

// notice → exited (actor null = the daily job)
async function completeExit(companyId: number, employee: Employee, actor: Express.AuthUser | null) {
  await db
    .update(employees)
    .set({ status: "exited", exited_at: new Date() })
    .where(and(eq(employees.company_id, companyId), eq(employees.id, employee.id)));
  await blockLogin(companyId, employee.id);
  await syncSubscriptionQuantity(companyId);
  audit(actor, {
    companyId,
    action: "employee.exited",
    target: ["employee", employee.id],
    summary: `${employee.name} left the company (last working day ${employee.exit_date ?? localDate()})${actor ? "" : " — closed automatically"}`,
  });
}

// POST /api/employees/:id/exit — start (or change) an exit
export async function startExit(companyId: number, actor: Express.AuthUser, id: number, input: ExitInput) {
  const employee = await getEmployeeById(companyId, id);
  if (employee.status === "exited") throw new BadRequestError(`${employee.name} has already left`);
  await assertCanAct(actor, employee);

  await db
    .update(employees)
    .set({ status: "notice", exit_date: input.lastWorkingDay, exit_reason: input.reason, exit_notes: input.notes ?? null })
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  const updated = await getEmployeeById(companyId, id);
  audit(actor, {
    companyId,
    action: employee.status === "notice" ? "employee.exit_updated" : "employee.exit_started",
    target: ["employee", id],
    summary: `${employee.status === "notice" ? "Changed the exit of" : "Started the exit of"} ${employee.name} — ${REASON_LABEL[input.reason]}, last working day ${input.lastWorkingDay}`,
  });
  // A last day already in the past: they've left
  if (input.lastWorkingDay < localDate()) await completeExit(companyId, updated, actor);
  return { employee: await getEmployeeById(companyId, id) };
}

// POST /api/employees/:id/cancel-exit — they're staying after all
export async function cancelExit(companyId: number, actor: Express.AuthUser, id: number) {
  const employee = await getEmployeeById(companyId, id);
  if (employee.status !== "notice") throw new BadRequestError(`${employee.name} isn't serving notice`);
  await assertCanAct(actor, employee);
  await db
    .update(employees)
    .set({ status: "active", exit_date: null, exit_reason: null, exit_notes: null })
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  audit(actor, { companyId, action: "employee.exit_cancelled", target: ["employee", id], summary: `Cancelled the exit of ${employee.name}` });
  return { employee: await getEmployeeById(companyId, id) };
}

// POST /api/employees/:id/rehire — bring someone who left back.
export async function rehire(companyId: number, actor: Express.AuthUser, id: number) {
  const employee = await getEmployeeById(companyId, id);
  if (employee.status !== "exited") throw new BadRequestError(`${employee.name} hasn't left`);
  await assertCanAct(actor, employee);
  await db
    .update(employees)
    .set({ status: "active", exit_date: null, exit_reason: null, exit_notes: null, exited_at: null })
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  await syncSubscriptionQuantity(companyId);
  audit(actor, { companyId, action: "employee.rehired", target: ["employee", id], summary: `Rehired ${employee.name}` });
  return { employee: await getEmployeeById(companyId, id) };
}

// The daily job: notices whose last working day has passed become exits
export async function completeDueExits() {
  const due = await db
    .select({ id: employees.id, company_id: employees.company_id })
    .from(employees)
    .where(and(eq(employees.status, "notice"), lt(employees.exit_date, localDate())));
  for (const row of due) {
    try {
      await completeExit(row.company_id, await getEmployeeById(row.company_id, row.id), null);
    } catch (err) {
      console.error(`Completing the exit of employee ${row.id} failed:`, (err as Error).message);
    }
  }
  return due.length;
}
