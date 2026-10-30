// Every query takes companyId and includes it in the WHERE clause. This is what
// enforces multi-tenancy at the data layer — even if a stray id got through,
// these queries never touch another company's rows.
import { and, asc, count, desc, eq, getTableColumns, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { departments, designations, employees, roles, shifts, users } from "../../db/schema.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { syncSubscriptionQuantity } from "../billing/billing.service.js";
import { assertDepartmentUsable, findOrCreateDepartment } from "../departments/departments.service.js";
import { assertShiftUsable } from "../shifts/shifts.service.js";
import { assertDesignationUsable, findOrCreateDesignation } from "../designations/designations.service.js";
import { roleByKey } from "../pages/access.service.js";
import { assertRoleAssignable } from "../roles/roles.service.js";
import type { EmployeeInput } from "./employees.schema.js";
import { audit } from "../../utils/audit.js";

// Employee rows as the API returns them: every column + their job title and role names
const employeeColumns = {
  ...getTableColumns(employees),
  designation: designations.name,
  department: departments.name,
  shift: shifts.name,
  role: roles.name,
  // Their login (if any): exists / blocked
  has_login: sql<boolean>`exists(select 1 from company_members m where m.employee_id = ${employees.id})`,
  login_blocked: sql<boolean>`coalesce((select u.is_blocked from company_members m join users u on u.id = m.user_id where m.employee_id = ${employees.id} limit 1), false)`,
};

function selectEmployees() {
  return db
    .select(employeeColumns)
    .from(employees)
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .leftJoin(departments, eq(departments.id, employees.department_id))
    .leftJoin(shifts, eq(shifts.id, employees.shift_id))
    .leftJoin(roles, eq(roles.id, employees.role_id));
}

export type Employee = typeof employees.$inferSelect & { designation: string | null; department: string | null; shift: string | null; role: string | null; has_login: boolean; login_blocked: boolean };

// ---- Lookups shared with other modules ----

export async function findEmployeeById(companyId: number, id: number): Promise<Employee | undefined> {
  const [employee] = await selectEmployees().where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  return employee;
}

export async function getEmployeeById(companyId: number, id: number): Promise<Employee> {
  const employee = await findEmployeeById(companyId, id);
  if (!employee) throw new NotFoundError("Employee not found");
  return employee;
}

export function findAllEmployees(companyId: number) {
  return selectEmployees().where(eq(employees.company_id, companyId)).orderBy(desc(employees.created_at));
}

export async function countEmployees(companyId: number) {
  // Billed seats: everyone who hasn't left
  const [row] = await db
    .select({ n: count() })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), ne(employees.status, "exited")));
  return row.n;
}

// Employees whose "Reports to" is the given employee (a manager's team)
export function findReports(companyId: number, managerId: number) {
  return selectEmployees()
    .where(and(eq(employees.company_id, companyId), eq(employees.manager_id, managerId)))
    .orderBy(asc(employees.name));
}

// Employee plus whoever they report to. Manager email falls back to the
// manager's login email when their employee record has none.
export async function findEmployeeWithManager(companyId: number, id: number) {
  const manager = alias(employees, "m");
  const [row] = await db
    .select({
      name: employees.name,
      manager_name: manager.name,
      manager_email: sql<string | null>`coalesce(${manager.email}, ${users.email})`,
    })
    .from(employees)
    .leftJoin(manager, eq(manager.id, employees.manager_id))
    .leftJoin(users, eq(users.employee_id, manager.id))
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  return row;
}

// Inserts the employee and keeps billing in step with the new headcount
export async function insertEmployee(companyId: number, values: Omit<typeof employees.$inferInsert, "company_id">) {
  const [created] = await db.insert(employees).values({ ...values, company_id: companyId }).returning({ id: employees.id });
  // Billing is per-employee, so headcount changes must reach the subscription
  await syncSubscriptionQuantity(companyId);
  return getEmployeeById(companyId, created.id);
}

// ---- Employees page ----

// The "reports to" manager must be another employee of this same company.
async function assertValidManager(companyId: number, managerId: number | null | undefined, employeeId: number | null = null) {
  if (!managerId) return;
  if (managerId === employeeId) throw new BadRequestError("An employee can't report to themselves");
  if (!(await findEmployeeById(companyId, managerId))) throw new BadRequestError("Manager not found");
}

// Job title: an id from this company's list, or (older clients) a name, added if new
async function resolveDesignation(companyId: number, input: EmployeeInput, currentId: number | null): Promise<number | null> {
  if (input.designationId) {
    await assertDesignationUsable(companyId, input.designationId, currentId);
    return input.designationId;
  }
  if (input.designation) return (await findOrCreateDesignation(companyId, input.designation)).id;
  return null;
}

// Department: an id from this company's list, or (older clients) a name, added if new
async function resolveDepartment(companyId: number, input: EmployeeInput, currentId: number | null): Promise<number | null> {
  if (input.departmentId) {
    await assertDepartmentUsable(companyId, input.departmentId, currentId);
    return input.departmentId;
  }
  if (input.department) return (await findOrCreateDepartment(companyId, input.department)).id;
  return null;
}

// Role: nobody gives a role above their own (assertRoleAssignable).
// Not sent → keep the current one (a new employee starts as Employee).
async function resolveRole(actor: Express.AuthUser, input: EmployeeInput, currentId: number | null, isNew: boolean): Promise<number | null> {
  if (input.roleId === undefined) return isNew ? ((await roleByKey("employee"))?.id ?? null) : currentId;
  const id = input.roleId;
  if (id) await assertRoleAssignable(actor, id, currentId);
  return id;
}

interface Current {
  designationId: number | null;
  departmentId: number | null;
  shiftId: number | null;
  roleId: number | null;
}

// Form values → columns. Missing optional fields are stored as NULL.
async function toColumns(companyId: number, actor: Express.AuthUser, input: EmployeeInput, current: Current | null = null) {
  return {
    name: input.name,
    designation_id: await resolveDesignation(companyId, input, current?.designationId ?? null),
    role_id: await resolveRole(actor, input, current?.roleId ?? null, current === null),
    department_id: await resolveDepartment(companyId, input, current?.departmentId ?? null),
    shift_id: input.shiftId ? (await assertShiftUsable(companyId, input.shiftId, current?.shiftId ?? null), input.shiftId) : null,
    email: input.email ?? null,
    join_date: input.joinDate ?? null,
    salary: input.salary == null ? null : String(input.salary),
    manager_id: input.managerId ?? null,
    date_of_birth: input.dateOfBirth ?? null,
    ol_quota: input.olQuota == null ? null : String(input.olQuota),
    employee_code: input.employeeCode || null,
    photo_url: input.photoUrl ?? null,
    phone: input.phone?.trim() || null,
    gender: input.gender ?? null,
    address: input.address?.trim() || null,
    employment_type: input.employmentType,
    emergency_contact_name: input.emergencyContactName?.trim() || null,
    emergency_contact_phone: input.emergencyContactPhone?.trim() || null,
  };
}

export async function setEmployeePhoto(companyId: number, id: number, photoUrl: string | null) {
  await db.update(employees).set({ photo_url: photoUrl }).where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
}

export async function listEmployees(companyId: number) {
  return { employees: await findAllEmployees(companyId) };
}

export async function createEmployee(companyId: number, actor: Express.AuthUser, input: EmployeeInput) {
  await assertValidManager(companyId, input.managerId);
  const employee = await insertEmployee(companyId, await toColumns(companyId, actor, input));
  audit(actor, { companyId, action: "employee.created", target: ["employee", employee.id], summary: `Added the employee ${employee.name}` });
  return { employee };
}

export async function updateEmployee(companyId: number, actor: Express.AuthUser, id: number, input: EmployeeInput) {
  const existing = await getEmployeeById(companyId, id);
  await assertValidManager(companyId, input.managerId, id);
  // Changing your own role could lock you out — someone above you does it
  if (id === actor.employeeId && !actor.isSuperadmin && input.roleId !== undefined && input.roleId !== existing.role_id) {
    throw new BadRequestError("You can't change your own role");
  }
  // Nobody edits someone ranked above them (their role could be changed)
  if (!actor.isSuperadmin && existing.role_id) {
    const [current] = await db.select({ level: roles.level }).from(roles).where(eq(roles.id, existing.role_id));
    if (current && current.level > actor.level) throw new ForbiddenError("You can't edit someone with a higher role");
  }

  await db
    .update(employees)
    .set(await toColumns(companyId, actor, input, { designationId: existing.designation_id, departmentId: existing.department_id, shiftId: existing.shift_id, roleId: existing.role_id }))
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  const employee = await getEmployeeById(companyId, id);
  if (employee.role_id !== existing.role_id) {
    const names = await db.select({ id: roles.id, name: roles.name }).from(roles);
    const roleName = (rid: number | null) => names.find((r) => r.id === rid)?.name ?? "none";
    audit(actor, {
      companyId,
      action: "employee.role_changed",
      target: ["employee", id],
      summary: `Changed ${employee.name}'s role from ${roleName(existing.role_id)} to ${roleName(employee.role_id)}`,
      meta: { from: existing.role_id, to: employee.role_id },
    });
  }
  return { employee };
}

export async function deleteEmployee(companyId: number, actor: Express.AuthUser, id: number) {
  const [deleted] = await db
    .delete(employees)
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)))
    .returning({ id: employees.id, name: employees.name });
  if (!deleted) throw new NotFoundError("Employee not found");
  audit(actor, { companyId, action: "employee.removed", target: ["employee", id], summary: `Removed the employee ${deleted.name}` });
  await syncSubscriptionQuantity(companyId);
}
