// Tickets: create, list, open, edit, move between statuses, reassign, comment, log time, attach files.
// Every change is written to ticket_events so the ticket shows who did what and when.
import { and, asc, desc, eq, getTableColumns, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { alias, type SelectedFields } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { getImageKit } from "../../config/imagekit.js";
import {
  employees,
  ticketCategories,
  ticketComments,
  ticketEvents,
  ticketModules,
  ticketPriorities,
  ticketProjects,
  ticketSettings,
  ticketStatuses,
  ticketTimeLogs,
  tickets,
  users,
  type Attachment,
} from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { can } from "../../utils/can.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { stamp } from "../../utils/stamp.js";
import { localDate } from "../../utils/workday.js";
import { notify } from "../notifications/notify.js";
import { storeFile, type UploadedFile } from "../upload/upload.service.js";
import { canCreate, checkAssignee, ensureDefaults } from "./ticketSettings.service.js";
import type { ListQuery, TicketInput } from "./tickets.schema.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const assignee = alias(employees, "assignee");
const second = alias(employees, "second");
const creator = alias(users, "creator");
const editor = alias(users, "editor");

export const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const minutesText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
const shortDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "none");

// Not done/closed and past its delivery date
export const isDelayed = (today: string) => sql<boolean>`(${ticketStatuses.kind} not in ('done', 'closed') and ${tickets.due_date} < ${today})`;
export const isFinished = sql`${ticketStatuses.kind} in ('done', 'closed')`;

// Columns every ticket row comes back with (names and colours for the UI)
export function namedColumns(today: string) {
  return {
    project_name: ticketProjects.name,
    module_name: ticketModules.name,
    category_name: ticketCategories.name,
    category_color: ticketCategories.color,
    priority_name: ticketPriorities.name,
    priority_color: ticketPriorities.color,
    status_name: ticketStatuses.name,
    status_color: ticketStatuses.color,
    status_kind: ticketStatuses.kind,
    assigned_to_name: assignee.name,
    assigned_to_photo: assignee.photo_url,
    assignee_manager_id: assignee.manager_id,
    secondary_name: second.name,
    created_by_name: creator.name,
    updated_by_name: editor.name,
    delayed: isDelayed(today),
  };
}
const { description: _d, attachments: _a, ...listColumns } = getTableColumns(tickets);
export { listColumns };

// select … from tickets with every name joined
export function selectTickets<T extends SelectedFields>(fields: T) {
  const q = db.select(fields).from(tickets).$dynamic();
  type Joinable = { innerJoin: (...a: unknown[]) => Joinable; leftJoin: (...a: unknown[]) => Joinable };
  return (q as unknown as Joinable)
    .innerJoin(ticketStatuses, eq(ticketStatuses.id, tickets.status_id))
    .leftJoin(ticketProjects, eq(ticketProjects.id, tickets.project_id))
    .leftJoin(ticketModules, eq(ticketModules.id, tickets.module_id))
    .leftJoin(ticketCategories, eq(ticketCategories.id, tickets.category_id))
    .leftJoin(ticketPriorities, eq(ticketPriorities.id, tickets.priority_id))
    .leftJoin(assignee, eq(assignee.id, tickets.assigned_to))
    .leftJoin(second, eq(second.id, tickets.secondary_assignee))
    .leftJoin(creator, eq(creator.id, tickets.created_by))
    .leftJoin(editor, eq(editor.id, tickets.updated_by)) as unknown as typeof q;
}

// Tickets you may see: yours, ones you created, your team's — or all with tickets.viewAll
export function visibleTo(actor: Express.AuthUser): SQL {
  if (can(actor, "tickets.viewAll")) return sql`true`;
  const me = actor.employeeId ?? -1;
  return or(eq(tickets.assigned_to, me), eq(tickets.secondary_assignee, me), eq(tickets.created_by, actor.id), eq(assignee.manager_id, me))!;
}

async function findOne(companyId: number, actor: Express.AuthUser, id: number) {
  const [t] = await selectTickets({ ...getTableColumns(tickets), ...namedColumns(localDate()) }).where(and(eq(tickets.company_id, companyId), eq(tickets.id, id), visibleTo(actor)));
  return t;
}
type TicketRow = NonNullable<Awaited<ReturnType<typeof findOne>>>;

async function getVisible(companyId: number, actor: Express.AuthUser, id: number): Promise<TicketRow> {
  const t = await findOne(companyId, actor, id);
  if (!t) throw new NotFoundError("Ticket not found");
  return t;
}

// What the actor may do with this ticket
function rights(actor: Express.AuthUser, t: TicketRow) {
  const me = actor.employeeId;
  const involved = me != null && (t.assigned_to === me || t.secondary_assignee === me);
  const manager = me != null && t.assignee_manager_id === me;
  const made = t.created_by === actor.id;
  const all = can(actor, "tickets.viewAll");
  return {
    edit: involved || manager || made || all,
    assign: involved || manager || made || all,
    log: me != null && (involved || manager || made || all),
    delete: can(actor, "tickets.settings") || (made && t.spent_minutes === 0 && t.status_kind === "open"),
  };
}

// ---- Lookups (must belong to the company; inactive only if the ticket already had it) ----

async function lookups(companyId: number, input: Partial<TicketInput>, current?: TicketRow) {
  const pick = async <R extends { is_active: boolean }>(rows: R[], keep: number | null | undefined, label: string) => {
    const r = rows[0];
    if (!r) throw new BadRequestError(`Pick a valid ${label}`);
    if (!r.is_active && r !== undefined && keep == null) throw new BadRequestError(`That ${label} is no longer in use`);
    return r;
  };
  const same = (a: number | null | undefined, b: number | null | undefined) => (a ?? null) === (b ?? null);
  const project = input.projectId
    ? await pick(await db.select().from(ticketProjects).where(and(eq(ticketProjects.company_id, companyId), eq(ticketProjects.id, input.projectId))), same(input.projectId, current?.project_id) ? 1 : null, "project")
    : null;
  const module = input.moduleId
    ? await pick(await db.select().from(ticketModules).where(and(eq(ticketModules.company_id, companyId), eq(ticketModules.id, input.moduleId))), same(input.moduleId, current?.module_id) ? 1 : null, "module")
    : null;
  if (module && module.project_id !== project?.id) throw new BadRequestError("That module belongs to another project");
  const category = input.categoryId
    ? await pick(await db.select().from(ticketCategories).where(and(eq(ticketCategories.company_id, companyId), eq(ticketCategories.id, input.categoryId))), same(input.categoryId, current?.category_id) ? 1 : null, "category")
    : null;
  const priority = input.priorityId
    ? await pick(await db.select().from(ticketPriorities).where(and(eq(ticketPriorities.company_id, companyId), eq(ticketPriorities.id, input.priorityId))), same(input.priorityId, current?.priority_id) ? 1 : null, "priority")
    : null;
  return { project, module, category, priority };
}

async function defaultsFor(companyId: number) {
  const [status] = await db.select().from(ticketStatuses).where(and(eq(ticketStatuses.company_id, companyId), eq(ticketStatuses.is_active, true))).orderBy(desc(ticketStatuses.is_default), sql`${ticketStatuses.kind} in ('done','closed')`, asc(ticketStatuses.sort_order));
  const [priority] = await db.select().from(ticketPriorities).where(and(eq(ticketPriorities.company_id, companyId), eq(ticketPriorities.is_active, true), eq(ticketPriorities.is_default, true)));
  return { status: status!, priority: priority ?? null };
}

async function statusRow(companyId: number, id: number) {
  const [s] = await db.select().from(ticketStatuses).where(and(eq(ticketStatuses.company_id, companyId), eq(ticketStatuses.id, id)));
  if (!s || !s.is_active) throw new BadRequestError("Pick a valid status");
  return s;
}

async function namesOf(companyId: number, ids: (number | null | undefined)[]) {
  const list = [...new Set(ids.filter((x): x is number => Boolean(x)))];
  if (!list.length) return new Map<number, string>();
  const rows = await db.select({ id: employees.id, name: employees.name }).from(employees).where(and(eq(employees.company_id, companyId), inArray(employees.id, list)));
  return new Map(rows.map((r) => [r.id, r.name]));
}

const event = (tx: Tx | typeof db, t: { id: number; company_id: number }, actor: { id: number } | null, kind: string, text: string, meta?: Record<string, unknown>) =>
  tx.insert(ticketEvents).values({ company_id: t.company_id, ticket_id: t.id, kind, text, meta: meta ?? null, created_by: actor?.id ?? null });

// Files are uploaded first, then referenced; only this company's ticket folder is accepted
const folderOf = (companyId: number) => `${env.IMAGEKIT_FOLDER}/companies/${companyId}/tickets/`;
function checkFiles(companyId: number, files: Attachment[] | undefined) {
  for (const f of files ?? []) if (!f.path.startsWith(folderOf(companyId))) throw new BadRequestError("Unknown file");
  return files ?? [];
}

export async function uploadTicketFile(companyId: number, actor: Express.AuthUser, file: UploadedFile | undefined) {
  const stored = await storeFile("ticket-file", { companyId, employeeId: actor.employeeId }, file);
  return { file: { path: stored.filePath, name: stored.fileName } };
}

export async function ticketFile(companyId: number, actor: Express.AuthUser, id: number, index: number) {
  const t = await getVisible(companyId, actor, id);
  const f = t.attachments[index];
  if (!f) throw new NotFoundError("File not found");
  return { url: getImageKit().url({ path: f.path, signed: true, expireSeconds: 300 }), name: f.name };
}

// ---- Create ----

export async function createTicket(companyId: number, actor: Express.AuthUser, input: TicketInput) {
  const settings = await ensureDefaults(companyId);
  const [team] = actor.employeeId ? await db.select({ n: sql<number>`count(*)::int` }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.manager_id, actor.employeeId))) : [{ n: 0 }];
  if (!canCreate(actor, settings, (team?.n ?? 0) > 0)) throw new ForbiddenError("Only managers can raise tickets here");
  if (settings.require_project && !input.projectId) throw new BadRequestError("Pick the project");

  const r = await lookups(companyId, input);
  const defaults = await defaultsFor(companyId);
  const status = input.statusId ? await statusRow(companyId, input.statusId) : defaults.status;
  const priority = r.priority ?? defaults.priority;
  const assignedTo = input.assignedTo ?? r.project?.default_assignee_id ?? null;
  const secondaryAssignee = input.secondaryAssignee && input.secondaryAssignee !== assignedTo ? input.secondaryAssignee : null;
  await checkAssignee(companyId, actor, settings, assignedTo);
  await checkAssignee(companyId, actor, settings, secondaryAssignee);

  // Delivery date: given → category's days → priority's SLA
  const today = localDate();
  const dueDate =
    input.dueDate ?? (r.category?.default_days != null ? addDays(today, r.category.default_days) : priority?.sla_hours ? addDays(today, Math.ceil(priority.sla_hours / 24)) : null);
  const finished = status.kind === "done" || status.kind === "closed";

  const row = await db.transaction(async (tx) => {
    const [n] = await tx
      .update(ticketSettings)
      .set({ next_number: sql`${ticketSettings.next_number} + 1` })
      .where(eq(ticketSettings.company_id, companyId))
      .returning({ number: sql<number>`${ticketSettings.next_number} - 1`, prefix: ticketSettings.prefix, digits: ticketSettings.number_digits });
    const code = `${n!.prefix}${String(n!.number).padStart(n!.digits, "0")}`;
    const [t] = await tx
      .insert(tickets)
      .values({
        company_id: companyId,
        number: n!.number,
        code,
        title: input.title,
        description: input.description ?? null,
        project_id: r.project?.id ?? null,
        module_id: r.module?.id ?? null,
        category_id: r.category?.id ?? null,
        priority_id: priority?.id ?? null,
        status_id: status.id,
        assigned_to: assignedTo,
        secondary_assignee: secondaryAssignee,
        reported_by_name: input.reportedByName ?? null,
        reported_by_mobile: input.reportedByMobile ?? null,
        page_url: input.pageUrl ?? null,
        due_date: dueDate,
        estimate_minutes: input.estimateMinutes ?? null,
        attachments: checkFiles(companyId, input.attachments),
        started_at: status.kind === "active" ? new Date() : null,
        resolved_at: finished ? new Date() : null,
        closed_at: status.kind === "closed" ? new Date() : null,
        ...stamp.created(actor),
      })
      .returning();
    await event(tx, t!, actor, "created", `Created as ${status.name}`);
    return t!;
  });

  if (settings.notify_on_assign) {
    const to = [assignedTo, secondaryAssignee].filter((x): x is number => Boolean(x)).map((employeeId) => ({ employeeId }));
    void notify({ companyId, to, type: "ticket.assigned", title: `${row.code} assigned to you`, body: row.title, link: `/tickets?id=${row.id}`, entity: ["ticket", row.id], actorId: actor.id });
  }
  audit(actor, { companyId, action: "ticket.create", target: ["ticket", row.id], summary: `Raised ${row.code} — ${row.title}` });
  return { ticket: { id: row.id, code: row.code } };
}

// ---- List (View Tickets) ----

function filters(companyId: number, actor: Express.AuthUser, q: ListQuery, today: string) {
  const me = actor.employeeId ?? -1;
  const scope =
    q.scope === "mine"
      ? or(eq(tickets.assigned_to, me), eq(tickets.secondary_assignee, me))
      : q.scope === "created"
        ? eq(tickets.created_by, actor.id)
        : q.scope === "team"
          ? eq(assignee.manager_id, me)
          : undefined;
  const search = q.q
    ? or(ilike(tickets.code, `%${q.q}%`), ilike(tickets.title, `%${q.q}%`), ilike(tickets.reported_by_name, `%${q.q}%`), /^\d+$/.test(q.q) ? eq(tickets.number, Number(q.q)) : undefined)
    : undefined;
  return and(
    eq(tickets.company_id, companyId),
    visibleTo(actor),
    scope,
    search,
    q.projectId ? inArray(tickets.project_id, q.projectId) : undefined,
    q.categoryId ? inArray(tickets.category_id, q.categoryId) : undefined,
    q.priorityId ? inArray(tickets.priority_id, q.priorityId) : undefined,
    q.assignedTo ? inArray(tickets.assigned_to, q.assignedTo) : undefined,
    q.departmentId ? eq(assignee.department_id, q.departmentId) : undefined,
    q.view === "open" ? sql`not ${isFinished}` : q.view === "finished" ? isFinished : q.view === "delayed" ? isDelayed(today) : undefined,
    q.createdFrom ? gte(sql`(${tickets.created_at} at time zone 'Asia/Kolkata')::date`, q.createdFrom) : undefined,
    q.createdTo ? lte(sql`(${tickets.created_at} at time zone 'Asia/Kolkata')::date`, q.createdTo) : undefined,
    q.dueFrom ? gte(tickets.due_date, q.dueFrom) : undefined,
    q.dueTo ? lte(tickets.due_date, q.dueTo) : undefined,
  );
}

const SORTS = { created: tickets.created_at, due: tickets.due_date, updated: tickets.updated_at, code: tickets.number } as const;

export async function listTickets(companyId: number, actor: Express.AuthUser, q: ListQuery) {
  const today = localDate();
  const base = filters(companyId, actor, q, today);
  const where = and(base, q.statusId ? inArray(tickets.status_id, q.statusId) : undefined);
  const col = SORTS[q.sort];
  const order = q.order === "asc" ? sql`${col} asc nulls last` : sql`${col} desc nulls last`;
  const [rows, [totals], byStatus] = await Promise.all([
    selectTickets({ ...listColumns, ...namedColumns(today) })
      .where(where)
      .orderBy(order, sql`${tickets.id} desc`)
      .limit(q.limit)
      .offset((q.page - 1) * q.limit),
    selectTickets({ total: sql<number>`count(*)::int`, delayed: sql<number>`count(*) filter (where ${isDelayed(today)})::int`, spent: sql<number>`coalesce(sum(${tickets.spent_minutes}), 0)::int` }).where(where),
    selectTickets({ status_id: tickets.status_id, n: sql<number>`count(*)::int` }).where(base).groupBy(tickets.status_id),
  ]);
  return {
    rows,
    total: totals?.total ?? 0,
    delayed: totals?.delayed ?? 0,
    spentMinutes: totals?.spent ?? 0,
    statusCounts: Object.fromEntries(byStatus.map((s) => [s.status_id, s.n])),
    page: q.page,
    limit: q.limit,
  };
}

// Up to 5,000 rows for Excel
export async function exportRows(companyId: number, actor: Express.AuthUser, q: ListQuery) {
  const today = localDate();
  const where = and(filters(companyId, actor, q, today), q.statusId ? inArray(tickets.status_id, q.statusId) : undefined);
  return selectTickets({ ...listColumns, ...namedColumns(today) })
    .where(where)
    .orderBy(sql`${SORTS[q.sort]} ${sql.raw(q.order)} nulls last`)
    .limit(5000);
}

// ---- One ticket with its comments, activity and time ----

export async function ticketDetail(companyId: number, actor: Express.AuthUser, id: number) {
  const t = await getVisible(companyId, actor, id);
  const [comments, events, time] = await Promise.all([
    db
      .select({ ...getTableColumns(ticketComments), created_by_name: creator.name, updated_by_name: editor.name })
      .from(ticketComments)
      .leftJoin(creator, eq(creator.id, ticketComments.created_by))
      .leftJoin(editor, eq(editor.id, ticketComments.updated_by))
      .where(eq(ticketComments.ticket_id, id))
      .orderBy(asc(ticketComments.created_at)),
    db
      .select({ id: ticketEvents.id, kind: ticketEvents.kind, text: ticketEvents.text, created_at: ticketEvents.created_at, created_by_name: creator.name })
      .from(ticketEvents)
      .leftJoin(creator, eq(creator.id, ticketEvents.created_by))
      .where(eq(ticketEvents.ticket_id, id))
      .orderBy(desc(ticketEvents.created_at), desc(ticketEvents.id)),
    db
      .select({ ...getTableColumns(ticketTimeLogs), employee_name: employees.name, created_by_name: creator.name })
      .from(ticketTimeLogs)
      .innerJoin(employees, eq(employees.id, ticketTimeLogs.employee_id))
      .leftJoin(creator, eq(creator.id, ticketTimeLogs.created_by))
      .where(eq(ticketTimeLogs.ticket_id, id))
      .orderBy(desc(ticketTimeLogs.work_date), desc(ticketTimeLogs.id)),
  ]);
  const { assignee_manager_id: _m, ...ticket } = t;
  return { ticket, comments, events, time, can: rights(actor, t) };
}

// ---- Edit ----

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description: "Description",
  reported_by_name: "Reported by",
  reported_by_mobile: "Reporter mobile",
  page_url: "Page / URL",
  estimate_minutes: "Estimate",
};

export async function updateTicket(companyId: number, actor: Express.AuthUser, id: number, input: TicketInput) {
  const t = await getVisible(companyId, actor, id);
  const can_ = rights(actor, t);
  if (!can_.edit) throw new ForbiddenError("You can't edit this ticket");
  const settings = await ensureDefaults(companyId);
  if (settings.require_project && !input.projectId) throw new BadRequestError("Pick the project");
  const r = await lookups(companyId, input, t);

  const assignedTo = input.assignedTo ?? null;
  const secondaryAssignee = input.secondaryAssignee && input.secondaryAssignee !== assignedTo ? input.secondaryAssignee : null;
  if (assignedTo !== t.assigned_to) await checkAssignee(companyId, actor, settings, assignedTo);
  if (secondaryAssignee !== t.secondary_assignee) await checkAssignee(companyId, actor, settings, secondaryAssignee);

  const next = {
    title: input.title,
    description: input.description ?? null,
    project_id: r.project?.id ?? null,
    module_id: r.module?.id ?? null,
    category_id: r.category?.id ?? null,
    priority_id: r.priority?.id ?? null,
    assigned_to: assignedTo,
    secondary_assignee: secondaryAssignee,
    reported_by_name: input.reportedByName ?? null,
    reported_by_mobile: input.reportedByMobile ?? null,
    page_url: input.pageUrl ?? null,
    due_date: input.dueDate ?? null,
    estimate_minutes: input.estimateMinutes ?? null,
    attachments: checkFiles(companyId, input.attachments),
  };

  // What changed, in words
  const people = await namesOf(companyId, [assignedTo, secondaryAssignee, t.assigned_to, t.secondary_assignee]);
  const nm = (v: number | null) => (v ? (people.get(v) ?? "someone") : "nobody");
  const changes: string[] = [];
  const ref = (label: string, before: number | null, after: number | null, oldName: string | null, newName: string | null | undefined) => {
    if ((before ?? null) !== (after ?? null)) changes.push(`${label}: ${oldName ?? "none"} → ${newName ?? "none"}`);
  };
  ref("Project", t.project_id, next.project_id, t.project_name, r.project?.name);
  ref("Module", t.module_id, next.module_id, t.module_name, r.module?.name);
  ref("Category", t.category_id, next.category_id, t.category_name, r.category?.name);
  ref("Priority", t.priority_id, next.priority_id, t.priority_name, r.priority?.name);
  if (t.assigned_to !== next.assigned_to) changes.push(`Assigned to: ${nm(t.assigned_to)} → ${nm(next.assigned_to)}`);
  if (t.secondary_assignee !== next.secondary_assignee) changes.push(`Secondary: ${nm(t.secondary_assignee)} → ${nm(next.secondary_assignee)}`);
  if (t.due_date !== next.due_date) changes.push(`Delivery date: ${shortDate(t.due_date)} → ${shortDate(next.due_date)}`);
  for (const [k, label] of Object.entries(FIELD_LABEL)) if ((t as Record<string, unknown>)[k] !== (next as Record<string, unknown>)[k]) changes.push(`${label} changed`);
  if (JSON.stringify(t.attachments) !== JSON.stringify(next.attachments)) changes.push("Files changed");
  if (!changes.length) return { ticket: { id, code: t.code }, changed: 0 };

  await db.transaction(async (tx) => {
    await tx.update(tickets).set({ ...next, ...stamp.updated(actor) }).where(eq(tickets.id, id));
    await event(tx, t, actor, "edited", changes.join(" · "));
  });
  const newPeople = [next.assigned_to, next.secondary_assignee].filter((e): e is number => Boolean(e) && e !== t.assigned_to && e !== t.secondary_assignee);
  if (newPeople.length && settings.notify_on_assign)
    void notify({ companyId, to: newPeople.map((employeeId) => ({ employeeId })), type: "ticket.assigned", title: `${t.code} assigned to you`, body: next.title, link: `/tickets?id=${id}`, entity: ["ticket", id], actorId: actor.id });
  return { ticket: { id, code: t.code }, changed: changes.length };
}

// ---- Status ----

export async function changeStatus(companyId: number, actor: Express.AuthUser, id: number, statusId: number, note?: string | null) {
  const t = await getVisible(companyId, actor, id);
  if (!rights(actor, t).edit) throw new ForbiddenError("You can't move this ticket");
  const s = await statusRow(companyId, statusId);
  if (s.id === t.status_id) return { ticket: { id, status_id: s.id } };
  const settings = await ensureDefaults(companyId);
  if (settings.require_time_on_done && (s.kind === "done" || s.kind === "closed") && t.spent_minutes === 0) throw new BadRequestError("Log the time you spent before marking it done");

  const finished = s.kind === "done" || s.kind === "closed";
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(tickets)
      .set({
        status_id: s.id,
        started_at: t.started_at ?? (s.kind === "active" ? now : null),
        resolved_at: finished ? (t.resolved_at ?? now) : null,
        closed_at: s.kind === "closed" ? (t.closed_at ?? now) : null,
        ...stamp.updated(actor),
      })
      .where(eq(tickets.id, id));
    await event(tx, t, actor, "status", `${t.status_name} → ${s.name}${note ? ` — ${note}` : ""}`, { from: t.status_id, to: s.id });
  });
  const to = [t.assigned_to, t.secondary_assignee].filter((x): x is number => Boolean(x)).map((employeeId) => ({ employeeId }));
  if (t.created_by) (to as { employeeId?: number; userId?: number }[]).push({ userId: t.created_by });
  void notify({ companyId, to, type: "ticket.status", title: `${t.code} is now ${s.name}`, body: note ?? t.title, link: `/tickets?id=${id}`, entity: ["ticket", id], actorId: actor.id });
  return { ticket: { id, status_id: s.id } };
}

// ---- Reassign ----

export async function reassign(companyId: number, actor: Express.AuthUser, id: number, input: { assignedTo?: number | null; secondaryAssignee?: number | null; note?: string | null }) {
  const t = await getVisible(companyId, actor, id);
  if (!rights(actor, t).assign) throw new ForbiddenError("You can't reassign this ticket");
  const settings = await ensureDefaults(companyId);
  const assignedTo = input.assignedTo ?? null;
  const secondaryAssignee = input.secondaryAssignee && input.secondaryAssignee !== assignedTo ? input.secondaryAssignee : null;
  if (assignedTo === t.assigned_to && secondaryAssignee === t.secondary_assignee) return { ticket: { id } };
  if (assignedTo !== t.assigned_to) await checkAssignee(companyId, actor, settings, assignedTo);
  if (secondaryAssignee !== t.secondary_assignee) await checkAssignee(companyId, actor, settings, secondaryAssignee);
  const people = await namesOf(companyId, [assignedTo, secondaryAssignee, t.assigned_to, t.secondary_assignee]);
  const nm = (v: number | null) => (v ? (people.get(v) ?? "someone") : "nobody");
  const parts: string[] = [];
  if (assignedTo !== t.assigned_to) parts.push(`Assigned to: ${nm(t.assigned_to)} → ${nm(assignedTo)}`);
  if (secondaryAssignee !== t.secondary_assignee) parts.push(`Secondary: ${nm(t.secondary_assignee)} → ${nm(secondaryAssignee)}`);
  await db.transaction(async (tx) => {
    await tx.update(tickets).set({ assigned_to: assignedTo, secondary_assignee: secondaryAssignee, ...stamp.updated(actor) }).where(eq(tickets.id, id));
    await event(tx, t, actor, "assigned", parts.join(" · ") + (input.note ? ` — ${input.note}` : ""));
  });
  const fresh = [assignedTo, secondaryAssignee].filter((e): e is number => Boolean(e) && e !== t.assigned_to && e !== t.secondary_assignee);
  if (fresh.length && settings.notify_on_assign)
    void notify({ companyId, to: fresh.map((employeeId) => ({ employeeId })), type: "ticket.assigned", title: `${t.code} assigned to you`, body: input.note ?? t.title, link: `/tickets?id=${id}`, entity: ["ticket", id], actorId: actor.id });
  return { ticket: { id } };
}

// ---- Comments ----

export async function addComment(companyId: number, actor: Express.AuthUser, id: number, body: string) {
  const t = await getVisible(companyId, actor, id);
  const [c] = await db.insert(ticketComments).values({ company_id: companyId, ticket_id: id, body, ...stamp.created(actor) }).returning();
  await db.update(tickets).set(stamp.updated(actor)).where(eq(tickets.id, id));
  const to: { employeeId?: number; userId?: number }[] = [t.assigned_to, t.secondary_assignee].filter((x): x is number => Boolean(x)).map((employeeId) => ({ employeeId }));
  if (t.created_by) to.push({ userId: t.created_by });
  void notify({ companyId, to, type: "ticket.comment", title: `New comment on ${t.code}`, body: body.slice(0, 140), link: `/tickets?id=${id}`, entity: ["ticket", id], actorId: actor.id });
  return { comment: c };
}

export async function deleteComment(companyId: number, actor: Express.AuthUser, id: number, commentId: number) {
  await getVisible(companyId, actor, id);
  const [c] = await db.select().from(ticketComments).where(and(eq(ticketComments.ticket_id, id), eq(ticketComments.id, commentId)));
  if (!c) throw new NotFoundError("Comment not found");
  if (c.created_by !== actor.id && !can(actor, "tickets.settings")) throw new ForbiddenError("You can delete only your own comments");
  await db.delete(ticketComments).where(eq(ticketComments.id, commentId));
}

// ---- Time ----

async function recountSpent(tx: Tx, ticketId: number) {
  await tx
    .update(tickets)
    .set({ spent_minutes: sql`(select coalesce(sum(minutes), 0)::int from ticket_time_logs where ticket_id = ${ticketId})` })
    .where(eq(tickets.id, ticketId));
}

export async function logTime(companyId: number, actor: Express.AuthUser, id: number, input: { workDate: string; minutes: number; note?: string | null }) {
  const t = await getVisible(companyId, actor, id);
  if (!rights(actor, t).log || !actor.employeeId) throw new ForbiddenError("You can't log time on this ticket");
  if (input.workDate > localDate()) throw new BadRequestError("You can't log time for a future date");
  const [{ day }] = await db
    .select({ day: sql<number>`coalesce(sum(${ticketTimeLogs.minutes}), 0)::int` })
    .from(ticketTimeLogs)
    .where(and(eq(ticketTimeLogs.company_id, companyId), eq(ticketTimeLogs.employee_id, actor.employeeId), eq(ticketTimeLogs.work_date, input.workDate)));
  if (day + input.minutes > 1440) throw new BadRequestError("That's more than 24 hours on that day");
  await db.transaction(async (tx) => {
    await tx.insert(ticketTimeLogs).values({ company_id: companyId, ticket_id: id, employee_id: actor.employeeId!, work_date: input.workDate, minutes: input.minutes, note: input.note ?? null, ...stamp.created(actor) });
    await recountSpent(tx, id);
    await tx.update(tickets).set(stamp.updated(actor)).where(eq(tickets.id, id));
    await event(tx, t, actor, "time", `Logged ${minutesText(input.minutes)} on ${shortDate(input.workDate)}${input.note ? ` — ${input.note}` : ""}`);
  });
  return { ok: true };
}

export async function deleteTime(companyId: number, actor: Express.AuthUser, id: number, logId: number) {
  const t = await getVisible(companyId, actor, id);
  const [l] = await db.select().from(ticketTimeLogs).where(and(eq(ticketTimeLogs.ticket_id, id), eq(ticketTimeLogs.id, logId)));
  if (!l) throw new NotFoundError("Time entry not found");
  if (l.created_by !== actor.id && !can(actor, "tickets.settings")) throw new ForbiddenError("You can remove only your own time");
  await db.transaction(async (tx) => {
    await tx.delete(ticketTimeLogs).where(eq(ticketTimeLogs.id, logId));
    await recountSpent(tx, id);
    await event(tx, t, actor, "time", `Removed ${minutesText(l.minutes)} logged on ${shortDate(l.work_date)}`);
  });
}

// ---- Delete ----

export async function deleteTicket(companyId: number, actor: Express.AuthUser, id: number) {
  const t = await getVisible(companyId, actor, id);
  if (!rights(actor, t).delete) throw new ForbiddenError("Only an untouched ticket you raised can be deleted");
  await db.delete(tickets).where(eq(tickets.id, id));
  audit(actor, { companyId, action: "ticket.delete", target: ["ticket", id], summary: `Deleted ${t.code} — ${t.title}` });
}
