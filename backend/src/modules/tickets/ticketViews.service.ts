// Task Tracker (kanban per employee) and Ticket Calendar (month view + project summary)
import { and, asc, between, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies, employees, holidays, ticketEvents, ticketProjects, ticketSettings, ticketStatuses, ticketTimeLogs, tickets } from "../../db/schema.js";
import { can } from "../../utils/can.js";
import { ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { ensureDefaults } from "./ticketSettings.service.js";
import { isDelayed, isFinished, listColumns, namedColumns, selectTickets } from "./tickets.service.js";

// Whose board / calendar: yours, or someone you manage (anyone with tickets.viewAll)
async function whose(companyId: number, actor: Express.AuthUser, employeeId?: number) {
  const id = employeeId ?? actor.employeeId;
  if (!id) throw new ForbiddenError("Your login isn't linked to an employee");
  const [e] = await db.select({ id: employees.id, name: employees.name, manager_id: employees.manager_id }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  if (!e) throw new NotFoundError("Employee not found");
  if (e.id !== actor.employeeId && !can(actor, "tickets.viewAll") && e.manager_id !== actor.employeeId) throw new ForbiddenError("You can see only your own and your team's tickets");
  return e;
}

// People whose board / calendar you can open
async function viewablePeople(companyId: number, actor: Express.AuthUser) {
  const me = actor.employeeId ?? -1;
  return db
    .select({ id: employees.id, name: employees.name, code: employees.employee_code })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), ne(employees.status, "exited"), can(actor, "tickets.viewAll") ? sql`true` : or(eq(employees.id, me), eq(employees.manager_id, me))))
    .orderBy(asc(employees.name));
}

const mine = (employeeId: number) => or(eq(tickets.assigned_to, employeeId), eq(tickets.secondary_assignee, employeeId));

// ---- Task Tracker ----

const DONE_KEEP_DAYS = 14;
const DONE_PER_COLUMN = 30;

export async function board(companyId: number, actor: Express.AuthUser, employeeId?: number) {
  await ensureDefaults(companyId);
  const e = await whose(companyId, actor, employeeId);
  const today = localDate();
  const [statuses, rows, people] = await Promise.all([
    db
      .select({ id: ticketStatuses.id, name: ticketStatuses.name, color: ticketStatuses.color, kind: ticketStatuses.kind })
      .from(ticketStatuses)
      .where(and(eq(ticketStatuses.company_id, companyId), eq(ticketStatuses.is_active, true)))
      .orderBy(asc(ticketStatuses.sort_order), asc(ticketStatuses.id)),
    selectTickets({ ...listColumns, ...namedColumns(today) })
      .where(and(eq(tickets.company_id, companyId), mine(e.id), or(sql`not ${isFinished}`, gte(tickets.updated_at, sql`now() - make_interval(days => ${DONE_KEEP_DAYS})`))))
      .orderBy(sql`${tickets.due_date} asc nulls last`, sql`${tickets.id} desc`),
    viewablePeople(companyId, actor),
  ]);
  // Done / closed columns keep only the latest few
  const seen = new Map<number, number>();
  const list = rows.filter((t) => {
    if (t.status_kind !== "done" && t.status_kind !== "closed") return true;
    const n = (seen.get(t.status_id) ?? 0) + 1;
    seen.set(t.status_id, n);
    return n <= DONE_PER_COLUMN;
  });
  const open = rows.filter((t) => t.status_kind !== "done" && t.status_kind !== "closed");
  return {
    employee: { id: e.id, name: e.name },
    statuses,
    tickets: list,
    people,
    counts: {
      delayed: open.filter((t) => t.delayed).length,
      dueToday: open.filter((t) => t.due_date === today).length,
      onTime: open.filter((t) => !t.delayed && t.due_date !== today).length,
    },
  };
}

// ---- Ticket Calendar ----

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function calendar(companyId: number, actor: Express.AuthUser, month: string, employeeId?: number) {
  await ensureDefaults(companyId);
  const e = await whose(companyId, actor, employeeId);
  const today = localDate();
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const to = `${month}-${String(last).padStart(2, "0")}`;

  const lite = {
    id: tickets.id,
    code: tickets.code,
    title: tickets.title,
    due_date: tickets.due_date,
    status_id: tickets.status_id,
    status_name: ticketStatuses.name,
    status_color: ticketStatuses.color,
    status_kind: ticketStatuses.kind,
    project_name: ticketProjects.name,
    priority_name: namedColumns(today).priority_name,
    priority_color: namedColumns(today).priority_color,
    delayed: isDelayed(today),
  };
  const [[company], offDays, due, logs, mineRows, people] = await Promise.all([
    db.select({ work_days: companies.work_days }).from(companies).where(eq(companies.id, companyId)),
    db.select({ date: holidays.date }).from(holidays).where(and(eq(holidays.company_id, companyId), eq(holidays.is_optional, false), between(holidays.date, from, to))),
    selectTickets(lite).where(and(eq(tickets.company_id, companyId), mine(e.id), between(tickets.due_date, from, to))),
    selectTickets({ ...lite, log_id: ticketTimeLogs.id, work_date: ticketTimeLogs.work_date, minutes: ticketTimeLogs.minutes, note: ticketTimeLogs.note })
      .innerJoin(ticketTimeLogs, eq(ticketTimeLogs.ticket_id, tickets.id))
      .where(and(eq(tickets.company_id, companyId), eq(ticketTimeLogs.employee_id, e.id), between(ticketTimeLogs.work_date, from, to))),
    // For the project summary: everything still open, plus what was created, due or finished this month
    selectTickets({ project_id: tickets.project_id, project_name: ticketProjects.name, status_kind: ticketStatuses.kind, delayed: isDelayed(today) }).where(
      and(
        eq(tickets.company_id, companyId),
        mine(e.id),
        or(sql`not ${isFinished}`, between(tickets.due_date, from, to), between(sql`(${tickets.resolved_at} at time zone 'Asia/Kolkata')::date`, from, to), between(sql`(${tickets.created_at} at time zone 'Asia/Kolkata')::date`, from, to)),
      ),
    ),
    viewablePeople(companyId, actor),
  ]);

  // Working days: the company's work days minus full holidays
  const work = new Set((company?.work_days ?? "mon,tue,wed,thu,fri").split(","));
  const off = new Set(offDays.map((h) => h.date));
  let workingDays = 0;
  for (let d = 1; d <= last; d++) {
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    if (work.has(DAY_KEYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]!) && !off.has(iso)) workingDays++;
  }

  type Lite = (typeof due)[number];
  const days = new Map<string, { date: string; due: Lite[]; worked: (Lite & { minutes: number; note: string | null })[]; minutes: number }>();
  const day = (d: string) => days.get(d) ?? (days.set(d, { date: d, due: [], worked: [], minutes: 0 }), days.get(d)!);
  for (const t of due) day(t.due_date!).due.push(t);
  for (const l of logs) {
    const { log_id: _id, work_date, minutes, note, ...t } = l;
    const d = day(work_date);
    d.minutes += minutes;
    const already = d.worked.find((w) => w.id === t.id);
    if (already) already.minutes += minutes;
    else d.worked.push({ ...t, minutes, note });
  }
  const totalMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  const daysWorked = new Set(logs.map((l) => l.work_date)).size;

  // Project-wise counts
  const summary = new Map<string, { project_id: number | null; project_name: string; open: number; active: number; hold: number; review: number; done: number; delayed: number; total: number }>();
  for (const r of mineRows) {
    const key = String(r.project_id ?? 0);
    const s = summary.get(key) ?? { project_id: r.project_id, project_name: r.project_name ?? "No project", open: 0, active: 0, hold: 0, review: 0, done: 0, delayed: 0, total: 0 };
    const kind = r.status_kind === "closed" ? "done" : (r.status_kind as "open" | "active" | "hold" | "review" | "done");
    s[kind]++;
    if (r.delayed) s.delayed++;
    s.total++;
    summary.set(key, s);
  }

  return {
    employee: { id: e.id, name: e.name },
    month,
    tiles: { workingDays, totalMinutes, daysWorked, avgMinutesPerDay: daysWorked ? Math.round(totalMinutes / daysWorked) : 0 },
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    projects: [...summary.values()].sort((a, b) => b.total - a.total || a.project_name.localeCompare(b.project_name)),
    people,
  };
}

// ---- Auto-close: done tickets move to Closed after the company's set number of days ----

export async function autoCloseTickets() {
  const rows = await db
    .select({ id: tickets.id, company_id: tickets.company_id, days: ticketSettings.auto_close_days })
    .from(tickets)
    .innerJoin(ticketStatuses, eq(ticketStatuses.id, tickets.status_id))
    .innerJoin(ticketSettings, eq(ticketSettings.company_id, tickets.company_id))
    .where(and(eq(ticketStatuses.kind, "done"), sql`${ticketSettings.auto_close_days} is not null`, lte(tickets.resolved_at, sql`now() - make_interval(days => ${ticketSettings.auto_close_days})`)))
    .limit(500);
  let closed = 0;
  for (const r of rows) {
    const [target] = await db
      .select({ id: ticketStatuses.id, name: ticketStatuses.name })
      .from(ticketStatuses)
      .where(and(eq(ticketStatuses.company_id, r.company_id), eq(ticketStatuses.kind, "closed"), eq(ticketStatuses.is_active, true)))
      .orderBy(asc(ticketStatuses.sort_order));
    if (!target) continue;
    await db.transaction(async (tx) => {
      await tx.update(tickets).set({ status_id: target.id, closed_at: new Date(), updated_at: new Date(), updated_by: null }).where(and(eq(tickets.id, r.id), isNull(tickets.closed_at)));
      await tx.insert(ticketEvents).values({ company_id: r.company_id, ticket_id: r.id, kind: "status", text: `Closed automatically after ${r.days} days in Done → ${target.name}`, created_by: null });
    });
    closed++;
  }
  return closed;
}
