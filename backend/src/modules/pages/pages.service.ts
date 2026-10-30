// Page Master (Super Admin): the app's pages and which roles can open each.
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../config/db.js";
import { appPageRoles, appPages, roles } from "../../db/schema.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { clearAccessCache } from "./access.service.js";
import type { PageInput } from "./pages.schema.js";
import { audit } from "../../utils/audit.js";

// System-role ids; Page Master never shows or touches custom roles' grants
const systemRoleIds = db.select({ id: roles.id }).from(roles).where(isNull(roles.company_id));

// Every page (active or not) with the system roles that can open it
export async function listPages() {
  const [pages, grants] = await Promise.all([
    db.select().from(appPages).orderBy(asc(appPages.sort_order), asc(appPages.id)),
    db.select().from(appPageRoles).where(inArray(appPageRoles.role_id, systemRoleIds)),
  ]);
  return {
    pages: pages.map((p) => ({ ...p, role_ids: grants.filter((g) => g.page_id === p.id).map((g) => g.role_id) })),
  };
}

async function assertValid(input: PageInput, id: number | null) {
  const [slugClash] = await db.select({ id: appPages.id }).from(appPages).where(eq(appPages.slug, input.slug));
  if (slugClash && slugClash.id !== id) throw new ConflictError(`Slug "${input.slug}" is already used`);
  if (input.url) {
    const [urlClash] = await db.select({ id: appPages.id }).from(appPages).where(eq(appPages.url, input.url));
    if (urlClash && urlClash.id !== id) throw new ConflictError(`URL "${input.url}" is already used`);
  }

  if (input.parentId) {
    if (input.parentId === id) throw new BadRequestError("A page can't be inside itself");
    // Walk up from the chosen parent: it must exist and must not be this page's own child
    let cursor: number | null = input.parentId;
    for (let depth = 0; cursor; depth++) {
      const [p] = await db.select({ id: appPages.id, parent_id: appPages.parent_id }).from(appPages).where(eq(appPages.id, cursor));
      if (!p) throw new BadRequestError("Parent page not found");
      if (p.id === id || depth > 10) throw new BadRequestError("That parent would put the page inside itself");
      cursor = p.parent_id;
    }
  }

  if (input.roleIds.length) {
    const found = await db.select({ id: roles.id }).from(roles).where(and(inArray(roles.id, input.roleIds), isNull(roles.company_id)));
    if (found.length !== new Set(input.roleIds).size) throw new BadRequestError("Unknown role");
  }
}

const columns = (input: PageInput) => ({
  name: input.name,
  slug: input.slug,
  url: input.url,
  icon: input.icon,
  parent_id: input.parentId,
  sort_order: input.sortOrder,
  show_in_menu: input.showInMenu,
  is_active: input.isActive,
});

async function saveGrants(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], pageId: number, roleIds: number[]) {
  await tx.delete(appPageRoles).where(and(eq(appPageRoles.page_id, pageId), inArray(appPageRoles.role_id, systemRoleIds)));
  const unique = [...new Set(roleIds)];
  if (unique.length) await tx.insert(appPageRoles).values(unique.map((r) => ({ page_id: pageId, role_id: r })));
}

export async function createPage(actor: Express.AuthUser, input: PageInput) {
  await assertValid(input, null);
  const page = await db.transaction(async (tx) => {
    const [row] = await tx.insert(appPages).values(columns(input)).returning();
    await saveGrants(tx, row.id, input.roleIds);
    return row;
  });
  clearAccessCache();
  audit(actor, { action: "page.created", target: ["page", page.id], summary: `Added the page ${page.name} (${page.url ?? "menu group"})`, meta: { roleIds: input.roleIds } });
  return { page: { ...page, role_ids: [...new Set(input.roleIds)] } };
}

export async function updatePage(actor: Express.AuthUser, id: number, input: PageInput) {
  await assertValid(input, id);
  const page = await db.transaction(async (tx) => {
    const [row] = await tx.update(appPages).set(columns(input)).where(eq(appPages.id, id)).returning();
    if (!row) throw new NotFoundError("Page not found");
    await saveGrants(tx, id, input.roleIds);
    return row;
  });
  clearAccessCache();
  audit(actor, { action: "page.updated", target: ["page", id], summary: `Updated the page ${page.name} — access: ${input.roleIds.length} role(s), ${input.isActive ? "active" : "inactive"}`, meta: { roleIds: input.roleIds } });
  return { page: { ...page, role_ids: [...new Set(input.roleIds)] } };
}

// Child pages move up to the top level (their parent link is cleared)
export async function deletePage(actor: Express.AuthUser, id: number) {
  const [deleted] = await db.delete(appPages).where(eq(appPages.id, id)).returning({ id: appPages.id, name: appPages.name });
  if (!deleted) throw new NotFoundError("Page not found");
  clearAccessCache();
  audit(actor, { action: "page.removed", target: ["page", id], summary: `Removed the page ${deleted.name}` });
}
