// A company's job titles ("UX Designer", "Accounts Lead"). Each company keeps
// its own list; titles are shown on profiles and payslips and never affect
// access (that's the role — modules/roles).
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { designations, employees } from "../../db/schema.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import type { DesignationInput } from "./designations.schema.js";

async function findByName(companyId: number, name: string) {
  const [row] = await db
    .select()
    .from(designations)
    .where(and(eq(designations.company_id, companyId), sql`lower(${designations.name}) = lower(${name.trim()})`));
  return row;
}

export async function listDesignations(companyId: number) {
  const rows = await db
    .select({
      id: designations.id,
      name: designations.name,
      is_active: designations.is_active,
      employee_count: sql<number>`(${count(employees.id)})::int`,
    })
    .from(designations)
    .leftJoin(employees, eq(employees.designation_id, designations.id))
    .where(eq(designations.company_id, companyId))
    .groupBy(designations.id)
    .orderBy(asc(sql`lower(${designations.name})`));
  return { designations: rows };
}

export async function createDesignation(companyId: number, { name, isActive }: DesignationInput) {
  if (await findByName(companyId, name)) throw new ConflictError(`"${name}" already exists`);
  const [row] = await db.insert(designations).values({ company_id: companyId, name, is_active: isActive }).returning();
  return { designation: { id: row.id, name: row.name, is_active: row.is_active, employee_count: 0 } };
}

export async function updateDesignation(companyId: number, id: number, { name, isActive }: DesignationInput) {
  const clash = await findByName(companyId, name);
  if (clash && clash.id !== id) throw new ConflictError(`"${name}" already exists`);
  const [row] = await db
    .update(designations)
    .set({ name, is_active: isActive })
    .where(and(eq(designations.company_id, companyId), eq(designations.id, id)))
    .returning();
  if (!row) throw new NotFoundError("Designation not found");
  return { designation: { id: row.id, name: row.name, is_active: row.is_active } };
}

// Employees who had it keep working — their designation just becomes empty
export async function deleteDesignation(companyId: number, id: number) {
  const [deleted] = await db
    .delete(designations)
    .where(and(eq(designations.company_id, companyId), eq(designations.id, id)))
    .returning({ id: designations.id });
  if (!deleted) throw new NotFoundError("Designation not found");
}

// For the employee form: the designation must be this company's and active
// (unless the employee already has it)
export async function assertDesignationUsable(companyId: number, id: number, currentId: number | null = null) {
  const [row] = await db.select().from(designations).where(and(eq(designations.company_id, companyId), eq(designations.id, id)));
  if (!row) throw new NotFoundError("Designation not found");
  if (id !== currentId && !row.is_active) throw new BadRequestError(`"${row.name}" is inactive`);
}

// Older clients send the title as text: use it, adding it to the list if new
export async function findOrCreateDesignation(companyId: number, name: string) {
  const existing = await findByName(companyId, name);
  if (existing) return existing;
  const [row] = await db.insert(designations).values({ company_id: companyId, name: name.trim() }).returning();
  return row;
}
