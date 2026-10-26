// The five fixed designations (Super Admin, Admin, HR, Accountant, Developer).
// They're shared by every company; only their display name and Active status
// can change (Super Admin only). What each one can open is set in the Page Master.
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { designations, employees } from "../../db/schema.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { clearAccessCache } from "../pages/access.service.js";
import type { UpdateDesignationInput } from "./designations.schema.js";

// All five, highest first, with how many of this company's employees have each
export async function listDesignations(companyId: number) {
  const rows = await db
    .select({
      id: designations.id,
      key: designations.key,
      name: designations.name,
      level: designations.level,
      is_active: designations.is_active,
      employee_count: sql<number>`(${count(employees.id)})::int`,
    })
    .from(designations)
    .leftJoin(employees, and(eq(employees.designation_id, designations.id), eq(employees.company_id, companyId)))
    .groupBy(designations.id)
    .orderBy(desc(designations.level));
  return { designations: rows };
}

export async function updateDesignation(id: number, { name, isActive }: UpdateDesignationInput) {
  const [current] = await db.select().from(designations).where(eq(designations.id, id));
  if (!current) throw new NotFoundError("Designation not found");
  if (current.key === "superadmin" && isActive === false) throw new BadRequestError("Super Admin can't be made inactive");
  if (name !== undefined) {
    const [clash] = await db.select({ id: designations.id }).from(designations).where(sql`lower(${designations.name}) = lower(${name})`);
    if (clash && clash.id !== id) throw new ConflictError(`"${name}" already exists`);
  }
  const [designation] = await db
    .update(designations)
    .set({ ...(name !== undefined ? { name } : {}), ...(isActive !== undefined ? { is_active: isActive } : {}) })
    .where(eq(designations.id, id))
    .returning();
  clearAccessCache();
  return { designation };
}

// Can `actor` give this designation to someone? It must exist, be active (unless
// the person already has it), and not rank above the actor. Super Admin is never given out.
export async function assertAssignable(actor: Express.AuthUser, designationId: number, currentId: number | null = null) {
  const [d] = await db.select().from(designations).where(eq(designations.id, designationId));
  if (!d) throw new NotFoundError("Designation not found");
  if (designationId === currentId) return; // unchanged
  if (d.key === "superadmin") throw new ForbiddenError("Super Admin can't be given from the app");
  if (!d.is_active) throw new BadRequestError(`"${d.name}" is inactive`);
  if (!actor.isSuperadmin && d.level > actor.level) throw new ForbiddenError(`You can't give the ${d.name} designation`);
}

// Older clients send a designation name instead of an id
export async function findDesignationByName(name: string) {
  const [d] = await db.select().from(designations).where(sql`lower(${designations.name}) = lower(${name.trim()})`);
  return d;
}
