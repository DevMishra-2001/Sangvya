// A company's departments ("Engineering", "Finance").
import { and, asc, count, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { departments, employees } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import type { DepartmentInput } from "./departments.schema.js";

const head = alias(employees, "head");

async function findByName(companyId: number, name: string) {
  const [row] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.company_id, companyId), sql`lower(${departments.name}) = lower(${name.trim()})`));
  return row;
}

// The head must be one of this company's employees
async function assertHead(companyId: number, headId: number | null | undefined) {
  if (!headId) return;
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.id, headId)));
  if (!row) throw new BadRequestError("The department head must be one of your employees");
}

async function listRows(companyId: number, id?: number) {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      code: departments.code,
      head_id: departments.head_id,
      head_name: head.name,
      is_active: departments.is_active,
      employee_count: sql<number>`(${count(employees.id)})::int`,
    })
    .from(departments)
    .leftJoin(employees, eq(employees.department_id, departments.id))
    .leftJoin(head, eq(head.id, departments.head_id))
    .where(id ? and(eq(departments.company_id, companyId), eq(departments.id, id)) : eq(departments.company_id, companyId))
    .groupBy(departments.id, head.name)
    .orderBy(asc(sql`lower(${departments.name})`));
}

export async function listDepartments(companyId: number) {
  return { departments: await listRows(companyId) };
}

export async function createDepartment(companyId: number, actor: Express.AuthUser, input: DepartmentInput) {
  if (await findByName(companyId, input.name)) throw new ConflictError(`"${input.name}" already exists`);
  await assertHead(companyId, input.headId);
  const [row] = await db
    .insert(departments)
    .values({ company_id: companyId, name: input.name, code: input.code, head_id: input.headId ?? null, is_active: input.isActive })
    .returning({ id: departments.id });
  audit(actor, { companyId, action: "department.created", target: ["department", row.id], summary: `Added the department ${input.name}` });
  const [department] = await listRows(companyId, row.id);
  return { department };
}

export async function updateDepartment(companyId: number, actor: Express.AuthUser, id: number, input: DepartmentInput) {
  const clash = await findByName(companyId, input.name);
  if (clash && clash.id !== id) throw new ConflictError(`"${input.name}" already exists`);
  await assertHead(companyId, input.headId);
  const [row] = await db
    .update(departments)
    .set({ name: input.name, code: input.code, head_id: input.headId ?? null, is_active: input.isActive })
    .where(and(eq(departments.company_id, companyId), eq(departments.id, id)))
    .returning({ id: departments.id });
  if (!row) throw new NotFoundError("Department not found");
  audit(actor, { companyId, action: "department.updated", target: ["department", id], summary: `Updated the department ${input.name}` });
  const [department] = await listRows(companyId, id);
  return { department };
}

// People in it stay — their department just becomes empty
export async function deleteDepartment(companyId: number, actor: Express.AuthUser, id: number) {
  const [deleted] = await db
    .delete(departments)
    .where(and(eq(departments.company_id, companyId), eq(departments.id, id)))
    .returning({ id: departments.id, name: departments.name });
  if (!deleted) throw new NotFoundError("Department not found");
  audit(actor, { companyId, action: "department.removed", target: ["department", id], summary: `Removed the department ${deleted.name}` });
}

// For the employee form: the department must be this company's and active (unless the employee is already in it)
export async function assertDepartmentUsable(companyId: number, id: number, currentId: number | null = null) {
  const [row] = await db.select().from(departments).where(and(eq(departments.company_id, companyId), eq(departments.id, id)));
  if (!row) throw new NotFoundError("Department not found");
  if (id !== currentId && !row.is_active) throw new BadRequestError(`"${row.name}" is inactive`);
}

// Older clients send the department as text: use it, adding it to the list if new
export async function findOrCreateDepartment(companyId: number, name: string) {
  const existing = await findByName(companyId, name);
  if (existing) return existing;
  const [row] = await db.insert(departments).values({ company_id: companyId, name: name.trim() }).returning();
  return row;
}
