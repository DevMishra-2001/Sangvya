// What a logged-in user can open and do, from their designation:
//   Super Admin (users.role = "superadmin") → every page, every permission
//   everyone else → the designation of their employee record in the current company
// Pages and their grants are cached in memory (they change rarely) and the
// cache is cleared whenever the Page Master saves.
import { asc, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { BASE_PERMISSIONS, DESIGNATION_PERMISSIONS, PAGE_PERMISSIONS, PERMISSION_KEYS, SUPERADMIN_ROLE, type Permission } from "../../config/permissions.js";
import { appPageAccess, appPages, designations, employees, type DesignationKey } from "../../db/schema.js";

export type PageRow = typeof appPages.$inferSelect;
export type Designation = typeof designations.$inferSelect;

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
  designation: { id: number; key: DesignationKey; name: string; level: number } | null;
  level: number; // 0 = no designation
  isSuperadmin: boolean;
  permissions: Permission[];
  pages: UserPage[];
}

// ---- Cache ----
const CACHE_MS = 60_000; // also bounds staleness if several servers run
let cache: { at: number; pages: PageRow[]; grants: Map<number, Set<number>>; designations: Designation[] } | null = null;

export function clearAccessCache() {
  cache = null;
}

async function loadCache() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const [pages, grantRows, designationRows] = await Promise.all([
    db.select().from(appPages).orderBy(asc(appPages.sort_order), asc(appPages.id)),
    db.select().from(appPageAccess),
    db.select().from(designations),
  ]);
  const grants = new Map<number, Set<number>>(); // designation id → page ids
  for (const g of grantRows) {
    if (!grants.has(g.designation_id)) grants.set(g.designation_id, new Set());
    grants.get(g.designation_id)!.add(g.page_id);
  }
  cache = { at: Date.now(), pages, grants, designations: designationRows };
  return cache;
}

export async function allDesignations() {
  return (await loadCache()).designations;
}

export async function designationByKey(key: DesignationKey) {
  return (await loadCache()).designations.find((d) => d.key === key);
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

// Active pages for a designation (or all for the Super Admin), plus the menu
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

// The designation on this user's current employee record
async function employeeDesignationId(employeeId: number | null) {
  if (!employeeId) return null;
  const [row] = await db.select({ id: employees.designation_id }).from(employees).where(eq(employees.id, employeeId));
  return row?.id ?? null;
}

// Platform pages a Super Admin can use without being in any company
const PLATFORM_SLUGS = new Set(["admins", "page-master"]);

export async function accessFor(user: { role: string; employee_id: number | null; company_id?: number | null }): Promise<Access> {
  const { pages, grants, designations: list } = await loadCache();

  if (user.role === SUPERADMIN_ROLE) {
    const d = list.find((x) => x.key === "superadmin");
    const all = pagesFor(pages, "all");
    return {
      designation: d ? { id: d.id, key: d.key, name: d.name, level: d.level } : null,
      level: 99,
      isSuperadmin: true,
      permissions: [...PERMISSION_KEYS],
      // No company yet → only the platform pages (company pages need a company)
      pages: user.company_id ? all : all.filter((p) => PLATFORM_SLUGS.has(p.slug)),
    };
  }

  const designationId = await employeeDesignationId(user.employee_id);
  const d = designationId ? list.find((x) => x.id === designationId) : undefined;
  // A Super Admin designation on a normal login gives no special power
  const effective = d && d.key !== "superadmin" ? d : undefined;
  const userPages = effective ? pagesFor(pages, grants.get(effective.id) ?? new Set()) : [];

  const permissions = new Set<Permission>(BASE_PERMISSIONS);
  for (const p of userPages) for (const perm of PAGE_PERMISSIONS[p.slug] ?? []) permissions.add(perm);
  for (const perm of (effective && DESIGNATION_PERMISSIONS[effective.key]) ?? []) permissions.add(perm);

  return {
    designation: effective ? { id: effective.id, key: effective.key, name: effective.name, level: effective.level } : null,
    level: effective?.level ?? 0,
    isSuperadmin: false,
    permissions: [...permissions],
    pages: userPages,
  };
}

// URLs the user may open — goes in the access token so the Next.js proxy can
// guard pages without an API call
export const allowedUrls = (access: Access) => access.pages.map((p) => p.url).filter((u): u is string => Boolean(u));
