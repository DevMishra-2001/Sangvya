// Every query takes companyId and includes it in the WHERE clause. This is what
// enforces multi-tenancy at the data layer — even if a stray id got through,
// these queries never touch another company's rows.
import { and, asc, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { designations, employees, users } from "../../db/schema.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import { syncSubscriptionQuantity } from "../billing/billing.service.js";
import { assertDesignationInCompany, findOrCreateDesignation } from "../designations/designations.service.js";
import type { EmployeeInput } from "./employees.schema.js";

// Employee rows as the API returns them: every column + the designation's name
const employeeColumns = { ...getTableColumns(employees), designation: designations.name };

function selectEmployees() {
  return db.select(employeeColumns).from(employees).leftJoin(designations, eq(designations.id, employees.designation_id));
}

export type Employee = typeof employees.$inferSelect & { designation: string | null };

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
  const [row] = await db.select({ n: count() }).from(employees).where(eq(employees.company_id, companyId));
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

// The designation to store: an id from the list, or (older clients) a typed name
async function resolveDesignation(companyId: number, input: EmployeeInput): Promise<number | null> {
  if (input.designationId) {
    await assertDesignationInCompany(companyId, input.designationId);
    return input.designationId;
  }
  if (input.designation) return (await findOrCreateDesignation(companyId, input.designation)).id;
  return null;
}

// Form values → columns. Missing optional fields are stored as NULL.
async function toColumns(companyId: number, input: EmployeeInput) {
  return {
    name: input.name,
    designation_id: await resolveDesignation(companyId, input),
    department: input.department ?? null,
    email: input.email ?? null,
    join_date: input.joinDate ?? null,
    salary: input.salary == null ? null : String(input.salary),
    manager_id: input.managerId ?? null,
    date_of_birth: input.dateOfBirth ?? null,
    ol_quota: input.olQuota == null ? null : String(input.olQuota),
    employee_code: input.employeeCode || null,
    photo_url: input.photoUrl ?? null,
  };
}

export async function setEmployeePhoto(companyId: number, id: number, photoUrl: string | null) {
  await db.update(employees).set({ photo_url: photoUrl }).where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
}

export async function listEmployees(companyId: number) {
  return { employees: await findAllEmployees(companyId) };
}

export async function createEmployee(companyId: number, input: EmployeeInput) {
  await assertValidManager(companyId, input.managerId);
  return { employee: await insertEmployee(companyId, await toColumns(companyId, input)) };
}

export async function updateEmployee(companyId: number, id: number, input: EmployeeInput) {
  await getEmployeeById(companyId, id);
  await assertValidManager(companyId, input.managerId, id);

  await db
    .update(employees)
    .set(await toColumns(companyId, input))
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  return { employee: await getEmployeeById(companyId, id) };
}

export async function deleteEmployee(companyId: number, id: number) {
  const [deleted] = await db
    .delete(employees)
    .where(and(eq(employees.company_id, companyId), eq(employees.id, id)))
    .returning({ id: employees.id });
  if (!deleted) throw new NotFoundError("Employee not found");
  await syncSubscriptionQuantity(companyId);
}
