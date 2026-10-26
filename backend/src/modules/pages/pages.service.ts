// Page Master (Super Admin): the app's pages and which designations can open each.
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../../config/db.js";
import { appPageAccess, appPages, designations } from "../../db/schema.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { clearAccessCache } from "./access.service.js";
import type { PageInput } from "./pages.schema.js";

// Every page (active or not) with the designations that can open it
export async function listPages() {
  const [pages, grants] = await Promise.all([
    db.select().from(appPages).orderBy(asc(appPages.sort_order), asc(appPages.id)),
    db.select().from(appPageAccess),
  ]);
  return {
    pages: pages.map((p) => ({ ...p, designation_ids: grants.filter((g) => g.page_id === p.id).map((g) => g.designation_id) })),
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

  if (input.designationIds.length) {
    const found = await db.select({ id: designations.id }).from(designations).where(inArray(designations.id, input.designationIds));
    if (found.length !== new Set(input.designationIds).size) throw new BadRequestError("Unknown designation");
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

async function saveGrants(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], pageId: number, designationIds: number[]) {
  await tx.delete(appPageAccess).where(eq(appPageAccess.page_id, pageId));
  const unique = [...new Set(designationIds)];
  if (unique.length) await tx.insert(appPageAccess).values(unique.map((d) => ({ page_id: pageId, designation_id: d })));
}

export async function createPage(input: PageInput) {
  await assertValid(input, null);
  const page = await db.transaction(async (tx) => {
    const [row] = await tx.insert(appPages).values(columns(input)).returning();
    await saveGrants(tx, row.id, input.designationIds);
    return row;
  });
  clearAccessCache();
  return { page: { ...page, designation_ids: [...new Set(input.designationIds)] } };
}

export async function updatePage(id: number, input: PageInput) {
  await assertValid(input, id);
  const page = await db.transaction(async (tx) => {
    const [row] = await tx.update(appPages).set(columns(input)).where(eq(appPages.id, id)).returning();
    if (!row) throw new NotFoundError("Page not found");
    await saveGrants(tx, id, input.designationIds);
    return row;
  });
  clearAccessCache();
  return { page: { ...page, designation_ids: [...new Set(input.designationIds)] } };
}

// Child pages move up to the top level (their parent link is cleared)
export async function deletePage(id: number) {
  const [deleted] = await db.delete(appPages).where(eq(appPages.id, id)).returning({ id: appPages.id });
  if (!deleted) throw new NotFoundError("Page not found");
  clearAccessCache();
}
