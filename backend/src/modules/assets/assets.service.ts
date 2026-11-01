// Asset inventory: add, assign to an employee, take back, history
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { assetAssignments, assets, branches, employees, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { offsetOf, pageMeta } from "../../utils/pagination.js";
import { assertBranchUsable } from "../branches/branches.service.js";
import type { AssetInput } from "./assets.schema.js";
import type { z } from "zod";
import type { assignManySchema, assignSchema, listQuery, returnSchema, statusSchema } from "./assets.schema.js";

const holder = sql<string | null>`(select e.name from asset_assignments a join employees e on e.id = a.employee_id where a.asset_id = ${assets.id} and a.returned_on is null limit 1)`;
const holderId = sql<number | null>`(select a.employee_id from asset_assignments a where a.asset_id = ${assets.id} and a.returned_on is null limit 1)`;
const heldSince = sql<string | null>`(select a.assigned_on::text from asset_assignments a where a.asset_id = ${assets.id} and a.returned_on is null limit 1)`;

const row = {
  id: assets.id,
  asset_code: assets.asset_code,
  name: assets.name,
  category: assets.category,
  brand: assets.brand,
  model: assets.model,
  serial_number: assets.serial_number,
  purchase_date: assets.purchase_date,
  purchase_cost: assets.purchase_cost,
  warranty_until: assets.warranty_until,
  condition: assets.condition,
  status: assets.status,
  branch_id: assets.branch_id,
  branch: branches.name,
  notes: assets.notes,
  holder_id: holderId,
  holder_name: holder,
  held_since: heldSince,
};

const select = () => db.select(row).from(assets).leftJoin(branches, eq(branches.id, assets.branch_id));

async function findAsset(companyId: number, id: number) {
  const [a] = await select().where(and(eq(assets.company_id, companyId), eq(assets.id, id)));
  if (!a) throw new NotFoundError("Asset not found");
  return a;
}

// AST-0001, AST-0002… (the highest used + 1)
async function nextCode(companyId: number) {
  const rows = await db.select({ code: assets.asset_code }).from(assets).where(eq(assets.company_id, companyId));
  const max = rows.reduce((m, r) => Math.max(m, Number(/^AST-(\d+)$/i.exec(r.code)?.[1] ?? 0)), 0);
  return `AST-${String(max + 1).padStart(4, "0")}`;
}

export async function listAssets(companyId: number, q: z.infer<typeof listQuery>) {
  const filters = [eq(assets.company_id, companyId)];
  if (q.status) filters.push(eq(assets.status, q.status));
  if (q.category) filters.push(eq(assets.category, q.category));
  if (q.search) {
    const like = `%${q.search.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(or(ilike(assets.asset_code, like), ilike(assets.name, like), ilike(assets.serial_number, like), ilike(assets.brand, like), sql`${holder} ilike ${like}`)!);
  }
  const where = and(...filters);
  const [rows, [{ n }], stats] = await Promise.all([
    select().where(where).orderBy(desc(assets.created_at), desc(assets.id)).limit(q.limit).offset(offsetOf(q.page, q.limit)),
    db.select({ n: count() }).from(assets).where(where),
    db
      .select({ status: assets.status, n: sql<number>`count(*)::int`, value: sql<string>`coalesce(sum(${assets.purchase_cost}), 0)::text` })
      .from(assets)
      .where(eq(assets.company_id, companyId))
      .groupBy(assets.status),
  ]);
  const byStatus = Object.fromEntries(stats.map((s) => [s.status, s.n]));
  const total = stats.reduce((t, s) => t + s.n, 0);
  const value = stats.filter((s) => s.status !== "retired" && s.status !== "lost").reduce((t, s) => t + Number(s.value), 0);
  return { assets: rows, stats: { total, value, ...byStatus }, ...pageMeta(q.page, q.limit, n) };
}

async function assertCodeFree(companyId: number, code: string, id: number | null) {
  const [clash] = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.company_id, companyId), sql`lower(${assets.asset_code}) = lower(${code})`));
  if (clash && clash.id !== id) throw new ConflictError(`Asset code ${code} is already used`);
}

const columns = (i: AssetInput) => ({
  name: i.name,
  category: i.category,
  brand: i.brand ?? null,
  model: i.model ?? null,
  serial_number: i.serialNumber ?? null,
  purchase_date: i.purchaseDate ?? null,
  purchase_cost: i.purchaseCost == null ? null : String(i.purchaseCost),
  warranty_until: i.warrantyUntil ?? null,
  condition: i.condition,
  branch_id: i.branchId ?? null,
  notes: i.notes ?? null,
});

export async function createAsset(companyId: number, actor: Express.AuthUser, input: AssetInput) {
  const code = input.assetCode?.toUpperCase() || (await nextCode(companyId));
  await assertCodeFree(companyId, code, null);
  if (input.branchId) await assertBranchUsable(companyId, input.branchId);
  const [created] = await db.insert(assets).values({ company_id: companyId, asset_code: code, ...columns(input) }).returning({ id: assets.id });
  audit(actor, { companyId, action: "asset.created", target: ["asset", created.id], summary: `Added the asset ${code} · ${input.name}` });
  return { asset: await findAsset(companyId, created.id) };
}

export async function updateAsset(companyId: number, actor: Express.AuthUser, id: number, input: AssetInput) {
  const current = await findAsset(companyId, id);
  const code = input.assetCode?.toUpperCase() || current.asset_code;
  await assertCodeFree(companyId, code, id);
  if (input.branchId) await assertBranchUsable(companyId, input.branchId, current.branch_id);
  await db.update(assets).set({ asset_code: code, ...columns(input) }).where(eq(assets.id, id));
  audit(actor, { companyId, action: "asset.updated", target: ["asset", id], summary: `Updated the asset ${code}` });
  return { asset: await findAsset(companyId, id) };
}

export async function deleteAsset(companyId: number, actor: Express.AuthUser, id: number) {
  const a = await findAsset(companyId, id);
  if (a.status === "assigned") throw new BadRequestError(`${a.asset_code} is with ${a.holder_name} — take it back first`);
  await db.delete(assets).where(eq(assets.id, id));
  audit(actor, { companyId, action: "asset.removed", target: ["asset", id], summary: `Removed the asset ${a.asset_code} · ${a.name}` });
}

export async function assignAsset(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof assignSchema>) {
  await assignAssets(companyId, actor, { ...input, items: [{ assetId: id }] });
  return { asset: await findAsset(companyId, id) };
}

const poolHolder = sql<string | null>`(select e.name from asset_assignments aa join employees e on e.id = aa.employee_id where aa.asset_id = "assets"."id" and aa.returned_on is null limit 1)`;
const titleCase = (key: string) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
type AssignItem = { assetId?: number | null; category?: (typeof assets.$inferSelect)["category"]; tag?: string | null };

// Hand items to an employee (all or nothing). A typed serial / asset no. picks that item, or adds it if it's new;
// no number takes a free unnumbered item of that category, or adds one.
export async function assignAssets(companyId: number, actor: Express.AuthUser, input: Omit<z.infer<typeof assignManySchema>, "items"> & { items: AssignItem[] }) {
  const [emp] = await db
    .select({ name: employees.name, status: employees.status })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), eq(employees.id, input.employeeId)));
  if (!emp) throw new NotFoundError("Employee not found");
  if (emp.status === "exited") throw new BadRequestError(`${emp.name} has left the company`);
  if (input.expectedReturn && input.expectedReturn < input.assignedOn) throw new BadRequestError("Return date must be after the assigned date");

  const pool = await db
    .select({ id: assets.id, asset_code: assets.asset_code, name: assets.name, category: assets.category, serial_number: assets.serial_number, status: assets.status, condition: assets.condition, holder: poolHolder })
    .from(assets)
    .where(eq(assets.company_id, companyId));
  const taken = new Set<number>();
  const busy = (a: (typeof pool)[number]) => {
    const label = a.serial_number ?? a.asset_code;
    if (a.status === "assigned") throw new BadRequestError(`${label} is already with ${a.holder ?? "someone"}`);
    if (a.status !== "available") throw new BadRequestError(`${label} isn't available (${a.status.replace("_", " ")})`);
    if (taken.has(a.id)) throw new BadRequestError(`${label} is added twice`);
  };
  const existing: (typeof pool)[number][] = [];
  const fresh: { category: NonNullable<AssignItem["category"]>; serial: string | null }[] = [];
  for (const item of input.items) {
    const tag = item.tag?.trim().toLowerCase();
    let found = item.assetId ? pool.find((a) => a.id === item.assetId) : tag ? pool.find((a) => a.serial_number?.toLowerCase() === tag || a.asset_code.toLowerCase() === tag) : undefined;
    if (item.assetId && !found) throw new NotFoundError("Asset not found");
    if (!found && !tag && item.category) {
      found = pool.find((a) => a.category === item.category && !a.serial_number && a.status === "available" && a.condition !== "damaged" && !taken.has(a.id));
    }
    if (found) {
      busy(found);
      taken.add(found.id);
      existing.push(found);
    } else if (item.category) {
      if (tag && fresh.some((f) => f.serial?.toLowerCase() === tag)) throw new BadRequestError(`${item.tag} is added twice`);
      fresh.push({ category: item.category, serial: item.tag?.trim() || null });
    } else throw new BadRequestError("Pick a category");
  }

  const ids = existing.map((a) => a.id);
  const created = await db.transaction(async (tx) => {
    // Status guard stops two people grabbing the same item at once
    if (ids.length) {
      const got = await tx
        .update(assets)
        .set({ status: "assigned" })
        .where(and(inArray(assets.id, ids), eq(assets.status, "available")))
        .returning({ id: assets.id });
      if (got.length !== ids.length) throw new BadRequestError("Some of these items were just given to someone else — try again");
    }
    let next = Number(/^AST-(\d+)$/.exec(await nextCode(companyId))?.[1] ?? 1);
    const made = fresh.length
      ? await tx
          .insert(assets)
          .values(
            fresh.map((f) => ({
              company_id: companyId,
              asset_code: `AST-${String(next++).padStart(4, "0")}`,
              name: titleCase(f.category),
              category: f.category,
              serial_number: f.serial,
              status: "assigned" as const,
            })),
          )
          .returning({ id: assets.id, asset_code: assets.asset_code, name: assets.name, serial_number: assets.serial_number })
      : [];
    await tx.insert(assetAssignments).values(
      [...ids, ...made.map((m) => m.id)].map((assetId) => ({
        company_id: companyId,
        asset_id: assetId,
        employee_id: input.employeeId,
        assigned_on: input.assignedOn,
        expected_return: input.expectedReturn ?? null,
        assigned_by: actor.id,
        assign_notes: input.notes ?? null,
      })),
    );
    return made;
  });
  const list = [...existing, ...created].map((a) => `${a.asset_code} · ${a.name}${a.serial_number ? ` (${a.serial_number})` : ""}`).join(", ");
  audit(actor, { companyId, action: "asset.assigned", target: ["employee", input.employeeId], summary: `Gave ${list} to ${emp.name}` });
  return { assigned: existing.length + created.length, added: created.length };
}

export async function returnAsset(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof returnSchema>) {
  const a = await findAsset(companyId, id);
  const [open] = await db
    .select()
    .from(assetAssignments)
    .where(and(eq(assetAssignments.company_id, companyId), eq(assetAssignments.asset_id, id), isNull(assetAssignments.returned_on)));
  if (!open) throw new BadRequestError(`${a.asset_code} isn't with anyone`);
  if (input.returnedOn < open.assigned_on) throw new BadRequestError("Returned date can't be before it was given");
  await db.transaction(async (tx) => {
    await tx
      .update(assetAssignments)
      .set({ returned_on: input.returnedOn, return_condition: input.condition, returned_to: actor.id, return_notes: input.notes ?? null })
      .where(eq(assetAssignments.id, open.id));
    await tx.update(assets).set({ status: input.status, condition: input.condition }).where(eq(assets.id, id));
  });
  audit(actor, { companyId, action: "asset.returned", target: ["employee", open.employee_id], summary: `${a.holder_name} returned ${a.asset_code} · ${a.name} (${input.condition})` });
  return { asset: await findAsset(companyId, id) };
}

export async function setAssetStatus(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof statusSchema>) {
  const a = await findAsset(companyId, id);
  if (a.status === "assigned") throw new BadRequestError(`${a.asset_code} is with ${a.holder_name} — take it back first`);
  await db.update(assets).set({ status: input.status }).where(eq(assets.id, id));
  audit(actor, { companyId, action: "asset.status", target: ["asset", id], summary: `Marked ${a.asset_code} as ${input.status.replace("_", " ")}${input.notes ? ` — ${input.notes}` : ""}` });
  return { asset: await findAsset(companyId, id) };
}

// Every hand-over of one asset, newest first
export async function assetHistory(companyId: number, id: number) {
  await findAsset(companyId, id);
  const rows = await db
    .select({
      id: assetAssignments.id,
      employee_id: assetAssignments.employee_id,
      employee_name: employees.name,
      assigned_on: assetAssignments.assigned_on,
      expected_return: assetAssignments.expected_return,
      assign_notes: assetAssignments.assign_notes,
      returned_on: assetAssignments.returned_on,
      return_condition: assetAssignments.return_condition,
      return_notes: assetAssignments.return_notes,
      assigned_by: sql<string | null>`(select u.name from users u where u.id = ${assetAssignments.assigned_by})`,
    })
    .from(assetAssignments)
    .innerJoin(employees, eq(employees.id, assetAssignments.employee_id))
    .where(and(eq(assetAssignments.company_id, companyId), eq(assetAssignments.asset_id, id)))
    .orderBy(desc(assetAssignments.assigned_on), desc(assetAssignments.id));
  return { history: rows };
}

// An employee's assets: with them now, and returned before
export async function employeeAssets(companyId: number, employeeId: number) {
  const rows = await db
    .select({
      assignment_id: assetAssignments.id,
      asset_id: assets.id,
      asset_code: assets.asset_code,
      name: assets.name,
      category: assets.category,
      serial_number: assets.serial_number,
      assigned_on: assetAssignments.assigned_on,
      expected_return: assetAssignments.expected_return,
      returned_on: assetAssignments.returned_on,
      return_condition: assetAssignments.return_condition,
    })
    .from(assetAssignments)
    .innerJoin(assets, eq(assets.id, assetAssignments.asset_id))
    .where(and(eq(assetAssignments.company_id, companyId), eq(assetAssignments.employee_id, employeeId)))
    .orderBy(asc(sql`${assetAssignments.returned_on} is not null`), desc(assetAssignments.assigned_on));
  return { current: rows.filter((r) => !r.returned_on), past: rows.filter((r) => r.returned_on) };
}

// Assets still with this employee (exit clearance)
export async function openAssetsOf(companyId: number, employeeId: number) {
  return db
    .select({ id: assets.id, asset_code: assets.asset_code, name: assets.name, assigned_on: assetAssignments.assigned_on })
    .from(assetAssignments)
    .innerJoin(assets, eq(assets.id, assetAssignments.asset_id))
    .where(and(eq(assetAssignments.company_id, companyId), eq(assetAssignments.employee_id, employeeId), isNull(assetAssignments.returned_on)));
}

// For the assign dialog: what's free right now
export async function availableAssets(companyId: number) {
  return db
    .select({ id: assets.id, asset_code: assets.asset_code, name: assets.name, category: assets.category, brand: assets.brand, model: assets.model, serial_number: assets.serial_number })
    .from(assets)
    .where(and(eq(assets.company_id, companyId), eq(assets.status, "available"), ne(assets.condition, "damaged")))
    .orderBy(asc(assets.asset_code));
}
