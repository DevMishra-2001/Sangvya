import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { MODULES } from "../../config/modules.js";
import { appPageRoles, appPages, employees, roles } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { clearAccessCache, disabledModules } from "../pages/access.service.js";
import type { CustomRoleInput } from "./customRoles.schema.js";

const pagesText = (n: number) => `${n} page${n === 1 ? "" : "s"}`;

// Pages a custom role can never get (managing roles, new companies, platform)
const NEVER = new Set(["custom-roles", "new-company", "platform-dashboard", "companies", "admins", "roles", "audit-log", "page-master"]);

async function systemRoles() {
  return db.select().from(roles).where(isNull(roles.company_id));
}

// Pages an Admin could hand out: the Admin role's pages, minus NEVER and switched-off modules
async function grantablePages(companyId: number) {
  const admin = (await systemRoles()).find((r) => r.key === "admin");
  if (!admin) return [];
  const [all, adminGrants, off] = await Promise.all([
    db.select().from(appPages).where(eq(appPages.is_active, true)),
    db.select({ page_id: appPageRoles.page_id }).from(appPageRoles).where(eq(appPageRoles.role_id, admin.id)),
    disabledModules(companyId),
  ]);
  const offSlugs = new Set(MODULES.filter((m) => off.has(m.key)).flatMap((m) => m.pages));
  const granted = new Set(adminGrants.map((g) => g.page_id));
  const byId = new Map(all.map((p) => [p.id, p]));
  return all
    .filter((p) => p.url && granted.has(p.id) && !NEVER.has(p.slug) && !offSlugs.has(p.slug))
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((p) => ({ id: p.id, name: p.name, slug: p.slug, group: p.parent_id ? (byId.get(p.parent_id)?.name ?? null) : null }));
}

async function grantsOf(roleIds: number[]) {
  if (!roleIds.length) return new Map<number, number[]>();
  const rows = await db.select().from(appPageRoles).where(inArray(appPageRoles.role_id, roleIds));
  const map = new Map<number, number[]>();
  for (const r of rows) map.set(r.role_id, [...(map.get(r.role_id) ?? []), r.page_id]);
  return map;
}

// GET /api/custom-roles → this company's roles, the bases to start from, and the pages to pick
export async function listCustomRoles(companyId: number) {
  const [rows, pages, bases] = await Promise.all([
    db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        base: roles.key,
        is_active: roles.is_active,
        created_at: roles.created_at,
        employee_count: sql<number>`(${count(employees.id)})::int`,
      })
      .from(roles)
      .leftJoin(employees, and(eq(employees.role_id, roles.id), eq(employees.company_id, companyId)))
      .where(eq(roles.company_id, companyId))
      .groupBy(roles.id)
      .orderBy(roles.name),
    grantablePages(companyId),
    systemRoles(),
  ]);
  const pageIds = new Set(pages.map((p) => p.id));
  const baseRows = bases.filter((b) => b.key === "hr" || b.key === "accountant" || b.key === "employee").sort((a, b) => b.level - a.level);
  const grants = await grantsOf([...rows.map((r) => r.id), ...baseRows.map((b) => b.id)]);
  const pick = (id: number) => (grants.get(id) ?? []).filter((p) => pageIds.has(p));
  return {
    roles: rows.map((r) => ({ ...r, page_ids: pick(r.id) })),
    bases: baseRows.map((b) => ({ key: b.key, name: b.name, page_ids: pick(b.id) })),
    pages,
  };
}

async function findCustom(companyId: number, id: number) {
  const [row] = await db.select().from(roles).where(and(eq(roles.id, id), eq(roles.company_id, companyId)));
  if (!row) throw new NotFoundError("Role not found");
  return row;
}

async function check(companyId: number, actor: Express.AuthUser, input: CustomRoleInput, id: number | null) {
  const system = await systemRoles();
  const base = system.find((r) => r.key === input.base);
  if (!base) throw new BadRequestError("Base role not found");
  if (!actor.isSuperadmin && base.level > actor.level) throw new ForbiddenError(`You can't create a role based on ${base.name}`);
  const lower = input.name.toLowerCase();
  if (system.some((r) => r.name.toLowerCase() === lower)) throw new ConflictError(`"${input.name}" is a built-in role — pick another name`);
  const [clash] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.company_id, companyId), sql`lower(${roles.name}) = ${lower}`));
  if (clash && clash.id !== id) throw new ConflictError(`A role called "${input.name}" already exists`);
  const allowed = new Set((await grantablePages(companyId)).map((p) => p.id));
  const bad = input.pageIds.filter((p) => !allowed.has(p));
  if (bad.length) throw new BadRequestError("Some of the chosen pages can't be given to a custom role");
  return base;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function saveGrants(tx: Tx, roleId: number, pageIds: number[]) {
  await tx.delete(appPageRoles).where(eq(appPageRoles.role_id, roleId));
  const unique = [...new Set(pageIds)];
  if (unique.length) await tx.insert(appPageRoles).values(unique.map((page_id) => ({ page_id, role_id: roleId })));
}

export async function createCustomRole(companyId: number, actor: Express.AuthUser, input: CustomRoleInput) {
  const base = await check(companyId, actor, input, null);
  const role = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(roles)
      .values({ company_id: companyId, key: base.key, level: base.level, name: input.name, description: input.description, is_active: input.isActive })
      .returning();
    await saveGrants(tx, row.id, input.pageIds);
    return row;
  });
  clearAccessCache();
  audit(actor, { companyId, action: "role.custom_created", target: ["role", role.id], summary: `Created the role ${role.name} (based on ${base.name}, ${pagesText(input.pageIds.length)})` });
  return { role };
}

export async function updateCustomRole(companyId: number, actor: Express.AuthUser, id: number, input: CustomRoleInput) {
  const current = await findCustom(companyId, id);
  const base = await check(companyId, actor, input, id);
  const role = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(roles)
      .set({ key: base.key, level: base.level, name: input.name, description: input.description, is_active: input.isActive })
      .where(eq(roles.id, id))
      .returning();
    await saveGrants(tx, id, input.pageIds);
    return row;
  });
  clearAccessCache();
  audit(actor, {
    companyId,
    action: "role.custom_updated",
    target: ["role", id],
    summary: `Updated the role ${role.name}${current.name !== role.name ? ` (was ${current.name})` : ""} — based on ${base.name}, ${pagesText(input.pageIds.length)}, ${role.is_active ? "active" : "inactive"}`,
  });
  return { role };
}

// Only when nobody has it — people must be moved to another role first
export async function deleteCustomRole(companyId: number, actor: Express.AuthUser, id: number) {
  const role = await findCustom(companyId, id);
  const [{ n }] = await db.select({ n: count() }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.role_id, id)));
  if (n > 0) throw new ConflictError(`${n} employee${n === 1 ? " has" : "s have"} this role — give them another role first`);
  await db.delete(roles).where(eq(roles.id, id)); // grants go with it (cascade)
  clearAccessCache();
  audit(actor, { companyId, action: "role.custom_removed", target: ["role", id], summary: `Removed the role ${role.name}` });
}
