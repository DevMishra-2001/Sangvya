// The five fixed roles (Super Admin, Admin, HR, Accountant, Employee). They
// decide what someone can open (Page Master) and do. Shared by every company;
// only their display name and Active status can change (Super Admin only).
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { employees, roles } from "../../db/schema.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { clearAccessCache } from "../pages/access.service.js";
import type { UpdateRoleInput } from "./roles.schema.js";
import { audit } from "../../utils/audit.js";

// All five, highest first, with how many of this company's employees have each
// employee_count: in this company, or across the platform without one
export async function listRoles(companyId: number | null) {
  const rows = await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      level: roles.level,
      is_active: roles.is_active,
      employee_count: sql<number>`(${count(employees.id)})::int`,
    })
    .from(roles)
    .leftJoin(employees, companyId ? and(eq(employees.role_id, roles.id), eq(employees.company_id, companyId)) : eq(employees.role_id, roles.id))
    .groupBy(roles.id)
    .orderBy(desc(roles.level));
  return { roles: rows };
}

export async function updateRole(actor: Express.AuthUser, id: number, { name, isActive }: UpdateRoleInput) {
  const [current] = await db.select().from(roles).where(eq(roles.id, id));
  if (!current) throw new NotFoundError("Role not found");
  if (current.key === "superadmin" && isActive === false) throw new BadRequestError("Super Admin can't be made inactive");
  if (name !== undefined) {
    const [clash] = await db.select({ id: roles.id }).from(roles).where(sql`lower(${roles.name}) = lower(${name})`);
    if (clash && clash.id !== id) throw new ConflictError(`"${name}" already exists`);
  }
  const [role] = await db
    .update(roles)
    .set({ ...(name !== undefined ? { name } : {}), ...(isActive !== undefined ? { is_active: isActive } : {}) })
    .where(eq(roles.id, id))
    .returning();
  clearAccessCache();
  audit(actor, { action: "role.updated", target: ["role", id], summary: `Updated the role ${current.name}${name && name !== current.name ? ` → renamed ${name}` : ""}${isActive !== undefined ? ` (${isActive ? "active" : "inactive"})` : ""}` });
  return { role };
}

// Can `actor` give this role to someone? It must exist, be active (unless the
// person already has it), and not rank above the actor. Super Admin is never given out.
export async function assertRoleAssignable(actor: Express.AuthUser, roleId: number, currentId: number | null = null) {
  const [r] = await db.select().from(roles).where(eq(roles.id, roleId));
  if (!r) throw new NotFoundError("Role not found");
  if (roleId === currentId) return; // unchanged
  if (r.key === "superadmin") throw new ForbiddenError("Super Admin can't be given from the app");
  if (!r.is_active) throw new BadRequestError(`The ${r.name} role is inactive`);
  if (!actor.isSuperadmin && r.level > actor.level) throw new ForbiddenError(`You can't give the ${r.name} role`);
}
