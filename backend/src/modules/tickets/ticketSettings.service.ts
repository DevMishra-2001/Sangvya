// Ticket settings per company: projects, modules, categories, statuses (with colours), priorities and general rules.
// Defaults are created the first time a company opens tickets.
import { and, asc, eq, getTableColumns, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { employees, ticketCategories, ticketModules, ticketPriorities, ticketProjects, ticketSettings, ticketStatuses, tickets, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { can } from "../../utils/can.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { stamp } from "../../utils/stamp.js";
import type { GeneralInput, SettingList } from "./tickets.schema.js";

const DEFAULT_STATUSES = [
  { name: "Assigned", color: "#2563eb", kind: "open", is_default: true },
  { name: "Scheduled", color: "#0891b2", kind: "open", is_default: false },
  { name: "In Progress", color: "#7c3aed", kind: "active", is_default: false },
  { name: "On Hold", color: "#f59e0b", kind: "hold", is_default: false },
  { name: "In Review", color: "#db2777", kind: "review", is_default: false },
  { name: "Done", color: "#16a34a", kind: "done", is_default: false },
  { name: "Closed", color: "#475569", kind: "closed", is_default: false },
];
const DEFAULT_PRIORITIES = [
  { name: "Low", color: "#64748b", sla_hours: 72, is_default: false },
  { name: "Normal", color: "#2563eb", sla_hours: 48, is_default: true },
  { name: "High", color: "#f59e0b", sla_hours: 24, is_default: false },
  { name: "Critical", color: "#dc2626", sla_hours: 4, is_default: false },
];
const DEFAULT_CATEGORIES = [
  { name: "Bug", color: "#dc2626", default_days: 2 },
  { name: "Modification", color: "#7c3aed", default_days: 5 },
  { name: "Support", color: "#0891b2", default_days: 1 },
  { name: "Training", color: "#f59e0b", default_days: 3 },
  { name: "New Feature", color: "#16a34a", default_days: 10 },
];

export type TicketSettingsRow = typeof ticketSettings.$inferSelect;

// The company's settings row, creating it and the default lists the first time
export async function ensureDefaults(companyId: number): Promise<TicketSettingsRow> {
  const [found] = await db.select().from(ticketSettings).where(eq(ticketSettings.company_id, companyId));
  if (found) return found;
  await db.transaction(async (tx) => {
    await tx.insert(ticketSettings).values({ company_id: companyId }).onConflictDoNothing();
    await tx.insert(ticketStatuses).values(DEFAULT_STATUSES.map((s, i) => ({ ...s, company_id: companyId, sort_order: i + 1 }))).onConflictDoNothing();
    await tx.insert(ticketPriorities).values(DEFAULT_PRIORITIES.map((p, i) => ({ ...p, company_id: companyId, sort_order: i + 1 }))).onConflictDoNothing();
    await tx.insert(ticketCategories).values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, company_id: companyId, sort_order: i + 1 }))).onConflictDoNothing();
  });
  const [row] = await db.select().from(ticketSettings).where(eq(ticketSettings.company_id, companyId));
  return row!;
}

const createdBy = alias(users, "created_by_user");
const updatedBy = alias(users, "updated_by_user");
const who = { created_by_name: createdBy.name, updated_by_name: updatedBy.name };

// Every list of the settings page, with who added / changed each row
export async function listSettings(companyId: number) {
  const general = await ensureDefaults(companyId);
  // How many tickets use each row (a used row can only be made inactive)
  const used = (column: string, ref: string) => sql<number>`(select count(*)::int from tickets x where x.${sql.raw(column)} = ${sql.raw(ref)})`;
  const [projects, modules, categories, statuses, priorities, [g]] = await Promise.all([
    db
      .select({ ...getTableColumns(ticketProjects), ...who, default_assignee_name: employees.name, tickets: used("project_id", '"ticket_projects"."id"'), modules: sql<number>`(select count(*)::int from ticket_modules m where m.project_id = "ticket_projects"."id")` })
      .from(ticketProjects)
      .leftJoin(employees, eq(employees.id, ticketProjects.default_assignee_id))
      .leftJoin(createdBy, eq(createdBy.id, ticketProjects.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, ticketProjects.updated_by))
      .where(eq(ticketProjects.company_id, companyId))
      .orderBy(asc(ticketProjects.sort_order), asc(ticketProjects.name)),
    db
      .select({ ...getTableColumns(ticketModules), ...who, project_name: ticketProjects.name, tickets: used("module_id", '"ticket_modules"."id"') })
      .from(ticketModules)
      .innerJoin(ticketProjects, eq(ticketProjects.id, ticketModules.project_id))
      .leftJoin(createdBy, eq(createdBy.id, ticketModules.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, ticketModules.updated_by))
      .where(eq(ticketModules.company_id, companyId))
      .orderBy(asc(ticketProjects.name), asc(ticketModules.name)),
    db
      .select({ ...getTableColumns(ticketCategories), ...who, tickets: used("category_id", '"ticket_categories"."id"') })
      .from(ticketCategories)
      .leftJoin(createdBy, eq(createdBy.id, ticketCategories.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, ticketCategories.updated_by))
      .where(eq(ticketCategories.company_id, companyId))
      .orderBy(asc(ticketCategories.sort_order), asc(ticketCategories.name)),
    db
      .select({ ...getTableColumns(ticketStatuses), ...who, tickets: used("status_id", '"ticket_statuses"."id"') })
      .from(ticketStatuses)
      .leftJoin(createdBy, eq(createdBy.id, ticketStatuses.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, ticketStatuses.updated_by))
      .where(eq(ticketStatuses.company_id, companyId))
      .orderBy(asc(ticketStatuses.sort_order), asc(ticketStatuses.id)),
    db
      .select({ ...getTableColumns(ticketPriorities), ...who, tickets: used("priority_id", '"ticket_priorities"."id"') })
      .from(ticketPriorities)
      .leftJoin(createdBy, eq(createdBy.id, ticketPriorities.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, ticketPriorities.updated_by))
      .where(eq(ticketPriorities.company_id, companyId))
      .orderBy(asc(ticketPriorities.sort_order), asc(ticketPriorities.id)),
    db
      .select({ ...who })
      .from(ticketSettings)
      .leftJoin(createdBy, eq(createdBy.id, ticketSettings.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, ticketSettings.updated_by))
      .where(eq(ticketSettings.company_id, companyId)),
  ]);
  return { general: { ...general, ...g }, projects, modules, categories, statuses, priorities };
}

// ---- Create / update / delete one row of a list ----

type Body = Record<string, unknown>;

const TABLES = {
  projects: ticketProjects,
  modules: ticketModules,
  categories: ticketCategories,
  statuses: ticketStatuses,
  priorities: ticketPriorities,
} as const;

const LABEL: Record<SettingList, string> = { projects: "project", modules: "module", categories: "category", statuses: "status", priorities: "priority" };
const TICKET_COLUMN: Record<SettingList, keyof typeof tickets.$inferSelect> = { projects: "project_id", modules: "module_id", categories: "category_id", statuses: "status_id", priorities: "priority_id" };

// API body (camelCase) → columns
function toRow(list: SettingList, b: Body): Record<string, unknown> {
  switch (list) {
    case "projects":
      return { name: b.name, code: b.code ?? null, client_name: b.clientName ?? null, version: b.version ?? null, description: b.description ?? null, default_assignee_id: b.defaultAssigneeId ?? null, is_active: b.isActive, sort_order: b.sortOrder };
    case "modules":
      return { project_id: b.projectId, name: b.name, is_active: b.isActive };
    case "categories":
      return { name: b.name, color: b.color, default_days: b.defaultDays ?? null, is_active: b.isActive, sort_order: b.sortOrder };
    case "statuses":
      return { name: b.name, color: b.color, kind: b.kind, is_default: b.isDefault, is_active: b.isActive, sort_order: b.sortOrder };
    case "priorities":
      return { name: b.name, color: b.color, sla_hours: b.slaHours ?? null, is_default: b.isDefault, is_active: b.isActive, sort_order: b.sortOrder };
  }
}

async function checkRow(companyId: number, list: SettingList, row: Record<string, unknown>) {
  if (list === "modules") {
    const [p] = await db.select({ id: ticketProjects.id }).from(ticketProjects).where(and(eq(ticketProjects.company_id, companyId), eq(ticketProjects.id, row.project_id as number)));
    if (!p) throw new BadRequestError("Pick a project");
  }
  if (list === "projects" && row.default_assignee_id) {
    const [e] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.id, row.default_assignee_id as number)));
    if (!e) throw new BadRequestError("Pick a valid default assignee");
  }
  if ((list === "statuses" || list === "priorities") && row.is_default && !row.is_active) throw new BadRequestError("The default can't be inactive");
}

const isUnique = (e: unknown) => (e as { cause?: { code?: string }; code?: string }).cause?.code === "23505" || (e as { code?: string }).code === "23505";

export async function saveSetting(companyId: number, actor: Express.AuthUser, list: SettingList, id: number | null, body: Body) {
  await ensureDefaults(companyId);
  const table = TABLES[list];
  const row = toRow(list, body);
  await checkRow(companyId, list, row);
  let saved;
  try {
    saved = await db.transaction(async (tx) => {
      // Only one default status / priority
      if ((list === "statuses" || list === "priorities") && row.is_default) {
        const t = TABLES[list];
        await tx.update(t).set({ is_default: false, ...stamp.updated(actor) }).where(and(eq(t.company_id, companyId), id ? ne(t.id, id) : sql`true`));
      }
      let row2;
      if (id) {
        if (list === "statuses" || list === "priorities") {
          const t = TABLES[list];
          const [cur] = await tx.select({ is_default: t.is_default }).from(t).where(and(eq(t.company_id, companyId), eq(t.id, id)));
          if (cur?.is_default && !row.is_default) throw new BadRequestError(`Make another ${LABEL[list]} the default first`);
        }
        [row2] = await tx
          .update(table)
          .set({ ...row, ...stamp.updated(actor) } as never)
          .where(and(eq(table.company_id, companyId), eq(table.id, id)))
          .returning();
        if (!row2) throw new NotFoundError(`That ${LABEL[list]} no longer exists`);
      } else {
        [row2] = await tx
          .insert(table)
          .values({ ...row, company_id: companyId, ...stamp.created(actor) } as never)
          .returning();
      }
      await keepOneStatusOfEachEnd(tx, companyId, list);
      return row2;
    });
  } catch (e) {
    if (isUnique(e)) throw new ConflictError(`A ${LABEL[list]} with this name already exists`);
    throw e;
  }
  audit(actor, { companyId, action: `tickets.${list}.${id ? "update" : "create"}`, summary: `${id ? "Changed" : "Added"} ticket ${LABEL[list]} "${String(body.name ?? "")}"` });
  return saved;
}

// Tickets need somewhere to start and somewhere to finish
async function keepOneStatusOfEachEnd(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], companyId: number, list: SettingList) {
  if (list !== "statuses") return;
  const rows = await tx.select({ kind: ticketStatuses.kind, is_active: ticketStatuses.is_active }).from(ticketStatuses).where(eq(ticketStatuses.company_id, companyId));
  const live = rows.filter((r) => r.is_active);
  if (!live.some((r) => r.kind === "done" || r.kind === "closed")) throw new BadRequestError("Keep at least one active Done or Closed status");
  if (!live.some((r) => r.kind !== "done" && r.kind !== "closed")) throw new BadRequestError("Keep at least one active open status");
}

export async function deleteSetting(companyId: number, actor: Express.AuthUser, list: SettingList, id: number) {
  const table = TABLES[list];
  const [row] = await db.select().from(table).where(and(eq(table.company_id, companyId), eq(table.id, id)));
  if (!row) throw new NotFoundError(`That ${LABEL[list]} no longer exists`);
  if ("is_default" in row && row.is_default) throw new BadRequestError(`Make another ${LABEL[list]} the default first`);
  const col = tickets[TICKET_COLUMN[list]] as typeof tickets.project_id;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(tickets).where(and(eq(tickets.company_id, companyId), eq(col, id)));
  if (n > 0) throw new BadRequestError(`${n} ticket${n === 1 ? " uses" : "s use"} this ${LABEL[list]} — mark it inactive instead`);
  await db.transaction(async (tx) => {
    await tx.delete(table).where(and(eq(table.company_id, companyId), eq(table.id, id)));
    await keepOneStatusOfEachEnd(tx, companyId, list);
  });
  audit(actor, { companyId, action: `tickets.${list}.delete`, summary: `Removed ticket ${LABEL[list]} "${row.name}"` });
}

export async function saveGeneral(companyId: number, actor: Express.AuthUser, input: GeneralInput) {
  await ensureDefaults(companyId);
  const [row] = await db
    .update(ticketSettings)
    .set({
      prefix: input.prefix,
      number_digits: input.numberDigits,
      who_can_create: input.whoCanCreate,
      assign_anyone: input.assignAnyone,
      allow_self_assign: input.allowSelfAssign,
      require_project: input.requireProject,
      require_time_on_done: input.requireTimeOnDone,
      auto_close_days: input.autoCloseDays ?? null,
      notify_on_assign: input.notifyOnAssign,
      ...stamp.updated(actor),
    })
    .where(eq(ticketSettings.company_id, companyId))
    .returning();
  audit(actor, { companyId, action: "tickets.settings.update", summary: "Changed ticket settings" });
  return row;
}

// ---- What the ticket screens need: active lists, people you can assign to, your powers ----

export async function ticketMeta(companyId: number, actor: Express.AuthUser) {
  const settings = await ensureDefaults(companyId);
  const [projects, modules, categories, statuses, priorities] = await Promise.all([
    db.select({ id: ticketProjects.id, name: ticketProjects.name, code: ticketProjects.code, version: ticketProjects.version, client_name: ticketProjects.client_name, default_assignee_id: ticketProjects.default_assignee_id, is_active: ticketProjects.is_active }).from(ticketProjects).where(eq(ticketProjects.company_id, companyId)).orderBy(asc(ticketProjects.sort_order), asc(ticketProjects.name)),
    db.select({ id: ticketModules.id, project_id: ticketModules.project_id, name: ticketModules.name, is_active: ticketModules.is_active }).from(ticketModules).where(eq(ticketModules.company_id, companyId)).orderBy(asc(ticketModules.name)),
    db.select({ id: ticketCategories.id, name: ticketCategories.name, color: ticketCategories.color, default_days: ticketCategories.default_days, is_active: ticketCategories.is_active }).from(ticketCategories).where(eq(ticketCategories.company_id, companyId)).orderBy(asc(ticketCategories.sort_order), asc(ticketCategories.name)),
    db.select({ id: ticketStatuses.id, name: ticketStatuses.name, color: ticketStatuses.color, kind: ticketStatuses.kind, is_default: ticketStatuses.is_default, is_active: ticketStatuses.is_active }).from(ticketStatuses).where(eq(ticketStatuses.company_id, companyId)).orderBy(asc(ticketStatuses.sort_order), asc(ticketStatuses.id)),
    db.select({ id: ticketPriorities.id, name: ticketPriorities.name, color: ticketPriorities.color, sla_hours: ticketPriorities.sla_hours, is_default: ticketPriorities.is_default, is_active: ticketPriorities.is_active }).from(ticketPriorities).where(eq(ticketPriorities.company_id, companyId)).orderBy(asc(ticketPriorities.sort_order), asc(ticketPriorities.id)),
  ]);
  const people = await assignablePeople(companyId, actor, settings);
  const reports = actor.employeeId ? await db.select({ id: employees.id }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.manager_id, actor.employeeId))) : [];
  return {
    settings,
    projects,
    modules,
    categories,
    statuses,
    priorities,
    people,
    me: { employeeId: actor.employeeId, userId: actor.id },
    can: {
      seeAll: can(actor, "tickets.viewAll"),
      seeTeam: reports.length > 0,
      settings: can(actor, "tickets.settings"),
      create: canCreate(actor, settings, reports.length > 0),
    },
  };
}

export const canCreate = (actor: Express.AuthUser, settings: TicketSettingsRow, hasTeam: boolean) =>
  Boolean(actor.employeeId || can(actor, "tasks.assignAnyone")) && (settings.who_can_create === "everyone" || hasTeam || can(actor, "tasks.assignAnyone"));

const assignsAnyone = (actor: Express.AuthUser, settings: TicketSettingsRow) => settings.assign_anyone || can(actor, "tasks.assignAnyone");

// Employees you can give a ticket to: everyone, or yourself + your team
export async function assignablePeople(companyId: number, actor: Express.AuthUser, settings: TicketSettingsRow) {
  const anyone = assignsAnyone(actor, settings);
  const mine = actor.employeeId ?? -1;
  return db
    .select({ id: employees.id, name: employees.name, code: employees.employee_code, photo_url: employees.photo_url, manager_id: employees.manager_id })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), ne(employees.status, "exited"), anyone ? sql`true` : sql`(${employees.id} = ${mine} OR ${employees.manager_id} = ${mine})`))
    .orderBy(asc(employees.name));
}

// Throws unless the actor may give a ticket to this employee
export async function checkAssignee(companyId: number, actor: Express.AuthUser, settings: TicketSettingsRow, employeeId: number | null | undefined) {
  if (!employeeId) return;
  const [e] = await db.select({ id: employees.id, manager_id: employees.manager_id, status: employees.status }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.id, employeeId)));
  if (!e || e.status === "exited") throw new BadRequestError("Pick someone who still works here");
  if (employeeId === actor.employeeId) {
    if (!settings.allow_self_assign && !can(actor, "tasks.assignAnyone")) throw new BadRequestError("Tickets can't be assigned to yourself here");
    return;
  }
  if (assignsAnyone(actor, settings) || e.manager_id === actor.employeeId) return;
  throw new BadRequestError("You can assign only to yourself or your team");
}
