// Probation: who's on it, when it ends, and the decision (confirm / extend / not confirmed)
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../config/db.js";
import { departments, designations, employees, notifications, probationEvents } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import { offsetOf, pageMeta } from "../../utils/pagination.js";
import { localDate } from "../../utils/workday.js";
import { startExit } from "../employees/employeeExit.service.js";
import { hrRecipients, notify } from "../notifications/notify.js";
import type { confirmSchema, extendSchema, listQuery, notConfirmedSchema, startSchema } from "./probation.schema.js";

const ACTIVE = ["on_probation", "extended"] as const;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const row = {
  id: employees.id,
  name: employees.name,
  photo_url: employees.photo_url,
  employee_code: employees.employee_code,
  designation: designations.name,
  department: departments.name,
  manager_name: sql<string | null>`(select m.name from employees m where m.id = ${employees.manager_id})`,
  join_date: sql<string>`coalesce(${employees.join_date}::text, (${employees.created_at} at time zone 'Asia/Kolkata')::date::text)`,
  probation_end_date: employees.probation_end_date,
  probation_status: employees.probation_status,
  confirmed_on: employees.confirmed_on,
  status: employees.status,
  extensions: sql<number>`(select count(*)::int from probation_events p where p.employee_id = ${employees.id} and p.action = 'extended')`,
};

const base = () =>
  db.select(row).from(employees).leftJoin(designations, eq(designations.id, employees.designation_id)).leftJoin(departments, eq(departments.id, employees.department_id));

export async function listProbations(companyId: number, q: z.infer<typeof listQuery>) {
  const today = localDate();
  const company = eq(employees.company_id, companyId);
  const active = and(company, inArray(employees.probation_status, [...ACTIVE]), sql`${employees.status} <> 'exited'`);
  const filters = [
    q.tab === "active" ? active : q.tab === "due" ? and(active, lte(employees.probation_end_date, addDays(today, 30)), gte(employees.probation_end_date, today))
    : q.tab === "overdue" ? and(active, sql`${employees.probation_end_date} < ${today}`)
    : q.tab === "decided" ? and(company, inArray(employees.probation_status, ["confirmed", "not_confirmed"]))
    : and(company, isNotNull(employees.probation_status)),
  ];
  if (q.search) {
    const like = `%${q.search.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(or(ilike(employees.name, like), ilike(employees.employee_code, like))!);
  }
  const where = and(...filters);
  const year = `${today.slice(0, 4)}-01-01`;
  const [rows, [{ n }], [stats]] = await Promise.all([
    base().where(where).orderBy(sql`${employees.probation_end_date} asc nulls last`, asc(employees.name)).limit(q.limit).offset(offsetOf(q.page, q.limit)),
    db.select({ n: count() }).from(employees).where(where),
    db
      .select({
        active: sql<number>`count(*) filter (where ${active})::int`,
        due: sql<number>`count(*) filter (where ${active} and ${employees.probation_end_date} between ${today} and ${addDays(today, 30)})::int`,
        overdue: sql<number>`count(*) filter (where ${active} and ${employees.probation_end_date} < ${today})::int`,
        confirmed: sql<number>`count(*) filter (where ${company} and ${employees.probation_status} = 'confirmed' and ${employees.confirmed_on} >= ${year})::int`,
        extended: sql<number>`count(*) filter (where ${active} and ${employees.probation_status} = 'extended')::int`,
      })
      .from(employees)
      .where(company),
  ]);
  return { people: rows, stats, today, ...pageMeta(q.page, q.limit, n) };
}

async function findPerson(companyId: number, id: number) {
  const [p] = await base().where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  if (!p) throw new NotFoundError("Employee not found");
  return p;
}

async function log(companyId: number, actor: Express.AuthUser | null, employeeId: number, action: (typeof probationEvents.$inferInsert)["action"], extra: { oldEnd?: string | null; newEnd?: string | null; notes?: string | null } = {}) {
  await db.insert(probationEvents).values({
    company_id: companyId,
    employee_id: employeeId,
    action,
    old_end: extra.oldEnd ?? null,
    new_end: extra.newEnd ?? null,
    notes: extra.notes ?? null,
    created_by: actor?.id ?? null,
  });
}

function assertActive(p: Awaited<ReturnType<typeof findPerson>>) {
  if (p.status === "exited") throw new BadRequestError(`${p.name} has left the company`);
  if (!p.probation_status || !(ACTIVE as readonly string[]).includes(p.probation_status)) throw new BadRequestError(`${p.name} isn't on probation`);
}

// Put someone on probation (or restart it)
export async function startProbation(companyId: number, actor: Express.AuthUser, input: z.infer<typeof startSchema>) {
  const p = await findPerson(companyId, input.employeeId);
  if (p.status === "exited") throw new BadRequestError(`${p.name} has left the company`);
  if (p.probation_status && (ACTIVE as readonly string[]).includes(p.probation_status)) throw new BadRequestError(`${p.name} is already on probation`);
  if (input.endDate <= p.join_date) throw new BadRequestError("Probation must end after the joining date");
  await db.update(employees).set({ probation_status: "on_probation", probation_end_date: input.endDate, confirmed_on: null }).where(eq(employees.id, p.id));
  await log(companyId, actor, p.id, "started", { newEnd: input.endDate, notes: input.notes });
  audit(actor, { companyId, action: "probation.started", target: ["employee", p.id], summary: `Put ${p.name} on probation until ${input.endDate}` });
  return { person: await findPerson(companyId, p.id) };
}

export async function confirmProbation(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof confirmSchema>) {
  const p = await findPerson(companyId, id);
  assertActive(p);
  await db.update(employees).set({ probation_status: "confirmed", confirmed_on: input.confirmedOn }).where(eq(employees.id, id));
  await log(companyId, actor, id, "confirmed", { notes: input.notes });
  audit(actor, { companyId, action: "probation.confirmed", target: ["employee", id], summary: `Confirmed ${p.name} (from ${input.confirmedOn})` });
  await notify({
    companyId,
    to: [{ employeeId: id }],
    type: "probation.confirmed",
    title: "Your probation is complete — you're confirmed 🎉",
    body: `Confirmed from ${input.confirmedOn}.`,
    link: "/",
    entity: ["employee", id],
    actorId: actor.id,
  });
  return { person: await findPerson(companyId, id) };
}

export async function extendProbation(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof extendSchema>) {
  const p = await findPerson(companyId, id);
  assertActive(p);
  if (p.probation_end_date && input.newEnd <= p.probation_end_date) throw new BadRequestError(`The new end must be after ${p.probation_end_date}`);
  await db.update(employees).set({ probation_status: "extended", probation_end_date: input.newEnd }).where(eq(employees.id, id));
  await log(companyId, actor, id, "extended", { oldEnd: p.probation_end_date, newEnd: input.newEnd, notes: input.notes });
  audit(actor, { companyId, action: "probation.extended", target: ["employee", id], summary: `Extended ${p.name}'s probation to ${input.newEnd}` });
  return { person: await findPerson(companyId, id) };
}

export async function notConfirm(companyId: number, actor: Express.AuthUser, id: number, input: z.infer<typeof notConfirmedSchema>) {
  const p = await findPerson(companyId, id);
  assertActive(p);
  await db.update(employees).set({ probation_status: "not_confirmed" }).where(eq(employees.id, id));
  await log(companyId, actor, id, "not_confirmed", { notes: input.notes });
  audit(actor, { companyId, action: "probation.not_confirmed", target: ["employee", id], summary: `Did not confirm ${p.name} after probation` });
  if (input.lastWorkingDay) await startExit(companyId, actor, id, { lastWorkingDay: input.lastWorkingDay, reason: "terminated", notes: `Not confirmed after probation: ${input.notes}` });
  return { person: await findPerson(companyId, id) };
}

export async function addNote(companyId: number, actor: Express.AuthUser, id: number, notes: string) {
  await findPerson(companyId, id);
  await log(companyId, actor, id, "note", { notes });
  return { success: true };
}

export async function probationHistory(companyId: number, id: number) {
  await findPerson(companyId, id);
  const rows = await db
    .select({
      id: probationEvents.id,
      action: probationEvents.action,
      old_end: probationEvents.old_end,
      new_end: probationEvents.new_end,
      notes: probationEvents.notes,
      by: sql<string | null>`(select u.name from users u where u.id = ${probationEvents.created_by})`,
      created_at: probationEvents.created_at,
    })
    .from(probationEvents)
    .where(and(eq(probationEvents.company_id, companyId), eq(probationEvents.employee_id, id)))
    .orderBy(desc(probationEvents.id));
  return { history: rows };
}

// Employee form saved a probation end date: start tracking it (once)
export async function syncProbationFromForm(companyId: number, actor: Express.AuthUser, employeeId: number) {
  const [e] = await db
    .select({ end: employees.probation_end_date, status: employees.probation_status })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), eq(employees.id, employeeId)));
  if (!e?.end || e.status) return;
  await db.update(employees).set({ probation_status: "on_probation" }).where(eq(employees.id, employeeId));
  await log(companyId, actor, employeeId, "started", { newEnd: e.end });
}

// Daily: remind HR and the manager a week before a probation ends (once per probation end date)
export async function remindDueProbations() {
  const today = localDate();
  const due = await db
    .select({ id: employees.id, company_id: employees.company_id, name: employees.name, end: employees.probation_end_date, manager_id: employees.manager_id })
    .from(employees)
    .where(and(inArray(employees.probation_status, [...ACTIVE]), sql`${employees.status} <> 'exited'`, gte(employees.probation_end_date, today), lte(employees.probation_end_date, addDays(today, 7))));
  let sent = 0;
  for (const p of due) {
    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.type, "probation.due"), eq(notifications.entity_type, "employee"), eq(notifications.entity_id, p.id), sql`${notifications.data}->>'end' = ${p.end}`))
      .limit(1);
    if (already) continue;
    const to = await hrRecipients(p.company_id);
    if (p.manager_id) to.push({ employeeId: p.manager_id });
    if (!to.length) continue;
    await notify({
      companyId: p.company_id,
      to,
      type: "probation.due",
      title: `${p.name}'s probation ends on ${p.end}`,
      body: "Confirm, extend or decide not to confirm on the Probation page.",
      link: "/probation?tab=due",
      entity: ["employee", p.id],
      data: { end: p.end },
    });
    sent++;
  }
  return sent;
}
