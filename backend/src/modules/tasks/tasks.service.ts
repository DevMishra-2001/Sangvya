import { and, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { can } from "../../utils/can.js";
import { employees, tasks, users } from "../../db/schema.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { findAllEmployees, findReports } from "../employees/employees.service.js";
import { notify } from "../notifications/notify.js";
import type { CreateTaskInput, ReviewTaskInput, TaskProgressInput } from "./tasks.schema.js";

const assignedBy = alias(users, "ab");
const approvedBy = alias(users, "ap");

// Every task row comes back with the names the UI shows on a task card
function selectTasks(where: SQL | undefined) {
  return db
    .select({
      ...getTableColumns(tasks),
      assigned_to_name: employees.name,
      assigned_by_name: assignedBy.name,
      approved_by_name: approvedBy.name,
    })
    .from(tasks)
    .innerJoin(employees, eq(employees.id, tasks.assigned_to))
    .leftJoin(assignedBy, eq(assignedBy.id, tasks.assigned_by))
    .leftJoin(approvedBy, eq(approvedBy.id, tasks.approved_by))
    .where(where);
}

type TaskRow = Awaited<ReturnType<typeof selectTasks>>[number];

const nullsLast = sql`${tasks.due_date} ASC NULLS LAST`;
const newestFirst = sql`${tasks.created_at} DESC`;

async function findTask(companyId: number, id: number): Promise<TaskRow | undefined> {
  const [task] = await selectTasks(and(eq(tasks.company_id, companyId), eq(tasks.id, id)));
  return task;
}

async function getTask(companyId: number, id: number): Promise<TaskRow> {
  const task = await findTask(companyId, id);
  if (!task) throw new NotFoundError("Task not found");
  return task;
}

// ---- Shaping ----

const isOpen = (t: TaskRow) => t.status === "todo" || t.status === "in_progress";
const isOverdue = (t: TaskRow, today: string) => isOpen(t) && Boolean(t.due_date) && t.due_date! < today;

const withFlags = (rows: TaskRow[], today: string) => rows.map((t) => ({ ...t, overdue: isOverdue(t, today) }));

// Numbers for the dashboard charts
function buildStats(rows: TaskRow[], today: string) {
  const counts: Record<string, number> = { approved: 0, done: 0, in_progress: 0, todo: 0, overdue: 0 };
  for (const t of rows) counts[isOverdue(t, today) ? "overdue" : t.status]++;

  // Tasks completed (done/approved) per week, last 8 weeks, Monday-based
  const weekStart = (d: string) => {
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  };
  const thisWeek = weekStart(today);
  const weeks: { week: string; completed: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const w = new Date(`${thisWeek}T00:00:00Z`);
    w.setUTCDate(w.getUTCDate() - i * 7);
    weeks.push({ week: w.toISOString().slice(0, 10), completed: 0 });
  }
  for (const t of rows) {
    if (!t.completed_at) continue;
    const slot = weeks.find((w) => w.week === weekStart(localDate(t.completed_at!)));
    if (slot) slot.completed++;
  }

  const total = rows.length;
  const finished = counts.done + counts.approved;
  const onTime = rows.filter((t) => t.completed_at && (!t.due_date || localDate(t.completed_at) <= t.due_date)).length;
  return {
    total,
    counts,
    weekly: weeks,
    completionRate: total ? Math.round((finished / total) * 100) : 0,
    onTimeRate: finished ? Math.round((onTime / finished) * 100) : 0,
    avgProgress: total ? Math.round(rows.reduce((s, t) => s + t.progress, 0) / total) : 0,
  };
}

// ---- Rules ----

// Who the user may assign tasks to: HR/superadmin -> anyone,
// a manager -> their own team (employees whose "Reports to" is them).
async function assignableEmployees(companyId: number, user: Express.AuthUser) {
  let list: Awaited<ReturnType<typeof findAllEmployees>> = [];
  if (can(user, "tasks.assignAnyone")) list = await findAllEmployees(companyId);
  else if (user.employeeId) list = await findReports(companyId, user.employeeId);
  return list.filter((e) => e.id !== user.employeeId); // never yourself
}

// Approve/reopen/delete: the assigner, or HR/superadmin — but never the assignee.
function canReview(user: Express.AuthUser, task: TaskRow) {
  if (user.employeeId && task.assigned_to === user.employeeId) return false;
  return task.assigned_by === user.id || can(user, "tasks.assignAnyone");
}

// ---- Endpoints ----

// Tasks assigned to me + chart stats. Open work first (by due date), then finished newest-first.
export async function myTasks(companyId: number, user: Express.AuthUser) {
  const today = localDate();
  if (!user.employeeId) return { tasks: [], stats: buildStats([], today) };
  const rows = await selectTasks(and(eq(tasks.company_id, companyId), eq(tasks.assigned_to, user.employeeId))).orderBy(
    sql`(${tasks.status} IN ('done', 'approved'))`,
    nullsLast,
    newestFirst,
  );
  return { tasks: withFlags(rows, today), stats: buildStats(rows, today) };
}

// Tasks I handed out (HR/superadmin see the whole company)
export async function assignedTasks(companyId: number, user: Express.AuthUser) {
  const scope = can(user, "tasks.assignAnyone")
    ? eq(tasks.company_id, companyId)
    : and(eq(tasks.company_id, companyId), eq(tasks.assigned_by, user.id));
  const rows = await selectTasks(scope).orderBy(sql`(${tasks.status} = 'approved')`, nullsLast, newestFirst);
  return { tasks: withFlags(rows, localDate()) };
}

export async function assignable(companyId: number, user: Express.AuthUser) {
  const list = await assignableEmployees(companyId, user);
  return { employees: list.map((e) => ({ id: e.id, name: e.name, designation: e.designation })) };
}

export async function createTask(companyId: number, user: Express.AuthUser, input: CreateTaskInput) {
  const allowed = await assignableEmployees(companyId, user);
  if (!allowed.some((e) => e.id === input.assignedTo)) throw new ForbiddenError("You can only assign tasks to your own team");

  const assignedDate = localDate();
  if (input.dueDate && input.dueDate < assignedDate) throw new BadRequestError("Due date can't be in the past");

  const [created] = await db
    .insert(tasks)
    .values({
      company_id: companyId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      assigned_to: input.assignedTo,
      assigned_by: user.id,
      due_date: input.dueDate ?? null,
      assigned_date: assignedDate,
    })
    .returning({ id: tasks.id });
  const task = await getTask(companyId, created.id);
  void notify({
    companyId,
    to: [{ employeeId: task.assigned_to }],
    type: "task.assigned",
    title: `New ticket: ${task.title}`,
    body: `From ${task.assigned_by_name ?? "your manager"} · ${task.priority} priority${task.due_date ? ` · due ${task.due_date}` : ""}`,
    link: "/tickets",
    entity: ["task", task.id],
    actorId: user.id,
    email: (r) => ({
      template: "taskAssigned",
      props: { name: r.name, by: task.assigned_by_name ?? "Your manager", title: task.title, priority: task.priority, due: task.due_date, description: task.description },
    }),
  });
  return { task: withFlags([task], assignedDate)[0] };
}

// The assignee moves their own task along
export async function updateProgress(companyId: number, user: Express.AuthUser, id: number, input: TaskProgressInput) {
  const task = await getTask(companyId, id);
  if (task.assigned_to !== user.employeeId) throw new ForbiddenError("This task isn't assigned to you");
  if (task.status === "approved") throw new BadRequestError("This task is already approved");

  const status = input.status ?? task.status;
  if (!["todo", "in_progress", "done"].includes(status)) throw new BadRequestError("Status must be todo, in_progress or done");

  let progress: number;
  if (status === "done") progress = 100;
  else if (status === "todo") progress = 0;
  else progress = Math.min(99, Math.max(1, input.progress ?? task.progress ?? 1)); // in progress: 1-99

  await db
    .update(tasks)
    .set({
      status,
      progress,
      updated_at: sql`now()`,
      completed_at: status === "done" ? sql`coalesce(${tasks.completed_at}, now())` : null,
    })
    .where(and(eq(tasks.company_id, companyId), eq(tasks.id, id)));
  // Finished → the person who assigned it reviews it
  if (status === "done" && task.status !== "done" && task.assigned_by) {
    void notify({
      companyId,
      to: [{ userId: task.assigned_by }],
      type: "task.done",
      title: `${task.assigned_to_name} finished: ${task.title}`,
      body: "Review it and approve, or reopen it.",
      link: "/tickets",
      entity: ["task", id],
      actorId: user.id,
      email: (r) => ({ template: "taskUpdate", props: { name: r.name, title: task.title, message: `${task.assigned_to_name} marked it done — review and approve it, or reopen it.` } }),
    });
  }
  return { task: withFlags([await getTask(companyId, id)], localDate())[0] };
}

// { action: "approve" | "reopen" }
export async function reviewTask(companyId: number, user: Express.AuthUser, id: number, { action }: ReviewTaskInput) {
  const task = await getTask(companyId, id);
  if (!canReview(user, task)) throw new ForbiddenError("You can't review this task");

  const where = and(eq(tasks.company_id, companyId), eq(tasks.id, id));
  if (action === "approve") {
    if (task.status !== "done") throw new BadRequestError("Only a task marked done can be approved");
    await db
      .update(tasks)
      .set({ status: "approved", approved_by: user.id, approved_at: sql`now()`, updated_at: sql`now()` })
      .where(where);
  } else {
    if (!["done", "approved"].includes(task.status)) throw new BadRequestError("Only a finished task can be reopened");
    await db
      .update(tasks)
      .set({
        status: "in_progress",
        progress: sql`least(${tasks.progress}, 90)`,
        completed_at: null,
        approved_by: null,
        approved_at: null,
        updated_at: sql`now()`,
      })
      .where(where);
  }
  void notify({
    companyId,
    to: [{ employeeId: task.assigned_to }],
    type: action === "approve" ? "task.approved" : "task.reopened",
    title: action === "approve" ? `Ticket approved: ${task.title}` : `Ticket reopened: ${task.title}`,
    body: action === "approve" ? "Nice work — it's closed." : "It needs a bit more work.",
    link: "/tickets",
    entity: ["task", id],
    actorId: user.id,
    email: (r) => ({
      template: "taskUpdate",
      props: { name: r.name, title: task.title, message: action === "approve" ? "your ticket was approved — it's closed." : "your ticket was reopened — it needs a bit more work." },
    }),
  });
  return { task: withFlags([await getTask(companyId, id)], localDate())[0] };
}

export async function deleteTask(companyId: number, user: Express.AuthUser, id: number) {
  const task = await getTask(companyId, id);
  if (!canReview(user, task)) throw new ForbiddenError("You can't delete this task");
  await db.delete(tasks).where(and(eq(tasks.company_id, companyId), eq(tasks.id, id)));
}
