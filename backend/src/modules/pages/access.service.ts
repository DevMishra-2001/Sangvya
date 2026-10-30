// What a logged-in user can open and do, from their ROLE:
//   Super Admin (users.role = "superadmin") → every page, every permission
//   everyone else → the role on their employee record in the current company
// Pages and their grants are cached in memory (they change rarely) and the
// cache is cleared whenever the Page Master saves.
import { asc, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { BASE_PERMISSIONS, PAGE_PERMISSIONS, PERMISSION_KEYS, ROLE_PERMISSIONS, SUPERADMIN_ROLE, type Permission } from "../../config/permissions.js";
import { MODULES } from "../../config/modules.js";
import { appPageRoles, appPages, companyModules, employees, roles, type RoleKey } from "../../db/schema.js";

export type PageRow = typeof appPages.$inferSelect;
export type Role = typeof roles.$inferSelect;

// The page shape the frontend gets (sidebar + page guard)
export interface UserPage {
  id: number;
  name: string;
  slug: string;
  url: string | null;
  icon: string | null;
  parent_id: number | null;
  sort_order: number;
  show_in_menu: boolean;
}

export interface Access {
  role: { id: number; key: RoleKey; name: string; level: number } | null;
  level: number; // 0 = no role
  isSuperadmin: boolean;
  permissions: Permission[];
  pages: UserPage[];
}

// ---- Cache ----
const CACHE_MS = 60_000; // also bounds staleness if several servers run
let cache: { at: number; pages: PageRow[]; grants: Map<number, Set<number>>; roles: Role[]; offModules: Map<number, Set<string>> } | null = null;

export function clearAccessCache() {
  cache = null;
}

async function loadCache() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const [pages, grantRows, roleRows, offRows] = await Promise.all([
    db.select().from(appPages).orderBy(asc(appPages.sort_order), asc(appPages.id)),
    db.select().from(appPageRoles),
    db.select().from(roles),
    db.select({ company_id: companyModules.company_id, key: companyModules.module_key }).from(companyModules).where(eq(companyModules.is_enabled, false)),
  ]);
  const offModules = new Map<number, Set<string>>(); // company id → modules switched off
  for (const r of offRows) {
    if (!offModules.has(r.company_id)) offModules.set(r.company_id, new Set());
    offModules.get(r.company_id)!.add(r.key);
  }
  const grants = new Map<number, Set<number>>(); // role id → page ids
  for (const g of grantRows) {
    if (!grants.has(g.role_id)) grants.set(g.role_id, new Set());
    grants.get(g.role_id)!.add(g.page_id);
  }
  cache = { at: Date.now(), pages, grants, roles: roleRows, offModules };
  return cache;
}

// Modules switched off for a company (empty = all on)
export async function disabledModules(companyId: number | null | undefined) {
  if (!companyId) return new Set<string>();
  return (await loadCache()).offModules.get(companyId) ?? new Set<string>();
}

export async function roleByKey(key: RoleKey) {
  return (await loadCache()).roles.find((r) => r.key === key && r.company_id === null);
}

const toUserPage = (p: PageRow): UserPage => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  url: p.url,
  icon: p.icon,
  parent_id: p.parent_id,
  sort_order: p.sort_order,
  show_in_menu: p.show_in_menu,
});

// Active pages for a role (or all for the Super Admin), plus the menu
// groups their pages sit in, so a granted child page never loses its group
function pagesFor(pages: PageRow[], allowed: Set<number> | "all") {
  const active = pages.filter((p) => p.is_active);
  const byId = new Map(active.map((p) => [p.id, p]));
  const ids = new Set(active.filter((p) => allowed === "all" || allowed.has(p.id)).map((p) => p.id));
  for (const id of [...ids]) {
    let parent = byId.get(id)?.parent_id;
    while (parent && byId.has(parent) && !ids.has(parent)) {
      ids.add(parent);
      parent = byId.get(parent)!.parent_id;
    }
  }
  return active.filter((p) => ids.has(p.id)).map(toUserPage);
}

// The role on this user's current employee record
async function employeeRoleId(employeeId: number | null) {
  if (!employeeId) return null;
  const [row] = await db.select({ id: employees.role_id }).from(employees).where(eq(employees.id, employeeId));
  return row?.id ?? null;
}

// Platform pages a Super Admin can use without being in any company
const PLATFORM_SLUGS = new Set(["platform-dashboard", "companies", "admins", "roles", "audit-log", "page-master"]);

export async function accessFor(user: { role: string; employee_id: number | null; company_id?: number | null }): Promise<Access> {
  const { pages, grants, roles: list, offModules } = await loadCache();

  if (user.role === SUPERADMIN_ROLE) {
    const d = list.find((x) => x.key === "superadmin" && x.company_id === null);
    const all = pagesFor(pages, "all");
    return {
      role: d ? { id: d.id, key: d.key, name: d.name, level: d.level } : null,
      level: 99,
      isSuperadmin: true,
      permissions: [...PERMISSION_KEYS],
      // No company yet → only the platform pages (company pages need a company)
      pages: user.company_id ? all : all.filter((p) => PLATFORM_SLUGS.has(p.slug)),
    };
  }

  const roleId = await employeeRoleId(user.employee_id);
  const d = roleId ? list.find((x) => x.id === roleId) : undefined;
  // A Super Admin role on a normal login gives no special power; a custom role only counts in its own company
  const effective = d && d.key !== "superadmin" && (d.company_id === null || d.company_id === user.company_id) ? d : undefined;
  const userPages = effective ? pagesFor(pages, grants.get(effective.id) ?? new Set()) : [];

  const permissions = new Set<Permission>(BASE_PERMISSIONS);
  for (const p of userPages) for (const perm of PAGE_PERMISSIONS[p.slug] ?? []) permissions.add(perm);
  for (const perm of (effective && ROLE_PERMISSIONS[effective.key]) ?? []) permissions.add(perm);

  // Modules the Super Admin switched off for this company: their pages and powers go
  const off = (user.company_id && offModules.get(user.company_id)) || null;
  let visiblePages = userPages;
  if (off?.size) {
    const offModuleDefs = MODULES.filter((m) => off.has(m.key));
    const offSlugs = new Set(offModuleDefs.flatMap((m) => m.pages));
    for (const m of offModuleDefs) for (const perm of m.permissions) permissions.delete(perm);
    visiblePages = userPages.filter((p) => !offSlugs.has(p.slug));
  }

  return {
    role: effective ? { id: effective.id, key: effective.key, name: effective.name, level: effective.level } : null,
    level: effective?.level ?? 0,
    isSuperadmin: false,
    permissions: [...permissions],
    pages: visiblePages,
  };
}

// URLs the user may open — goes in the access token so the Next.js proxy can
// guard pages without an API call
export const allowedUrls = (access: Access) => access.pages.map((p) => p.url).filter((u): u is string => Boolean(u));
