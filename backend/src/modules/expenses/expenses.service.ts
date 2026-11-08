// Expenses: advance requests (salary / TA-DA) and expense claims — submit, manager approves, accounts pays.
// TA/DA balance = TA/DA advances paid − approved expenses + reimbursements paid (negative = the company owes the employee).
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { getImageKit } from "../../config/imagekit.js";
import { departments, employeePrivate, employees, expenseAdvances, expenseClaims, expenseTravelLines, users, type Attachment } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { can } from "../../utils/can.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { hrRecipients, notify } from "../notifications/notify.js";
import { createLoan } from "../payroll/payroll.service.js";
import { storeFile, type UploadedFile } from "../upload/upload.service.js";
import type { AdvanceInput, ClaimInput, DecisionInput, ListQuery, PayInput } from "./expenses.schema.js";

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const rupees = (v: number) => `₹${v.toLocaleString("en-IN")}`;
const MAX_FILES = 10;

// ---- People and who decides ----

async function person(companyId: number, employeeId: number) {
  const [p] = await db
    .select({ id: employees.id, name: employees.name, manager_id: employees.manager_id, status: employees.status, manager_status: sql<string | null>`(select m.status from employees m where m.id = ${employees.manager_id})` })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), eq(employees.id, employeeId)));
  if (!p) throw new NotFoundError("Employee not found");
  return p;
}

// The reporting manager decides; anyone with expense.manage (accounts / HR) can too — never your own
function canDecide(actor: Express.AuthUser, employeeId: number, managerId: number | null) {
  if (actor.employeeId === employeeId) return false;
  return can(actor, "expense.manage") || (actor.employeeId != null && managerId === actor.employeeId);
}

async function approvers(companyId: number, p: { manager_id: number | null; manager_status: string | null }) {
  return p.manager_id && p.manager_status !== "exited" ? [{ employeeId: p.manager_id }] : await hrRecipients(companyId);
}

function mustSee(actor: Express.AuthUser, employeeId: number, managerId: number | null) {
  if (actor.employeeId === employeeId || canDecide(actor, employeeId, managerId)) return;
  throw new ForbiddenError("You can't see this");
}

// Files are uploaded first, then referenced; only this company's expense folder is accepted
const folderOf = (companyId: number) => `${env.IMAGEKIT_FOLDER}/companies/${companyId}/expenses/`;
function checkFiles(companyId: number, files: Attachment[] | undefined) {
  for (const f of files ?? []) if (!f.path.startsWith(folderOf(companyId))) throw new BadRequestError("Unknown file");
  if ((files?.length ?? 0) > MAX_FILES) throw new BadRequestError(`At most ${MAX_FILES} files`);
  return files ?? [];
}

export async function uploadBill(companyId: number, actor: Express.AuthUser, file: UploadedFile | undefined) {
  const stored = await storeFile("expense-bill", { companyId, employeeId: actor.employeeId }, file);
  return { file: { path: stored.filePath, name: stored.fileName } };
}

const signed = (path: string) => getImageKit().url({ path, signed: true, expireSeconds: 300 });

// ---- Bank details for the advance form ----

export async function myBank(companyId: number, employeeId: number) {
  const [b] = await db
    .select({ ifsc: employeePrivate.ifsc, account_number: employeePrivate.account_number, bank_name: employeePrivate.bank_name })
    .from(employeePrivate)
    .where(and(eq(employeePrivate.company_id, companyId), eq(employeePrivate.employee_id, employeeId)));
  return { bank: b ?? null };
}

// ---- Advances ----

export async function createAdvance(companyId: number, actor: Express.AuthUser, input: AdvanceInput & { attachments?: Attachment[] }) {
  if (!actor.employeeId) throw new ForbiddenError("Your login isn't linked to an employee");
  const p = await person(companyId, actor.employeeId);
  const [row] = await db
    .insert(expenseAdvances)
    .values({
      company_id: companyId,
      employee_id: p.id,
      advance_type: input.advanceType,
      amount: String(input.amount),
      purpose: input.purpose,
      expected_date: input.expectedDate ?? null,
      ifsc: input.ifsc ?? null,
      account_number: input.accountNumber ?? null,
      bank_name: input.bankName ?? null,
      attachments: checkFiles(companyId, input.attachments),
    })
    .returning({ id: expenseAdvances.id });
  void notify({
    companyId,
    to: await approvers(companyId, p),
    type: "expense.advance",
    title: `Advance request: ${p.name} — ${rupees(input.amount)}`,
    body: `${input.advanceType === "salary" ? "Against salary" : "Against TA/DA"} · ${input.purpose}`,
    link: "/expenses?kind=advances&scope=team",
    entity: ["advance", row.id],
    actorId: actor.id,
  });
  return { id: row.id };
}

async function findAdvance(companyId: number, id: number) {
  const [a] = await db
    .select({ a: expenseAdvances, name: employees.name, manager_id: employees.manager_id })
    .from(expenseAdvances)
    .innerJoin(employees, eq(employees.id, expenseAdvances.employee_id))
    .where(and(eq(expenseAdvances.company_id, companyId), eq(expenseAdvances.id, id)));
  if (!a) throw new NotFoundError("Advance request not found");
  return a;
}

export async function advanceDetail(companyId: number, actor: Express.AuthUser, id: number) {
  const x = await findAdvance(companyId, id);
  mustSee(actor, x.a.employee_id, x.manager_id);
  const [decider] = x.a.decided_by ? await db.select({ name: users.name }).from(users).where(eq(users.id, x.a.decided_by)) : [];
  return { advance: { ...x.a, employee_name: x.name, decided_by_name: decider?.name ?? null }, can: { decide: canDecide(actor, x.a.employee_id, x.manager_id) && ["pending", "on_hold"].includes(x.a.status), pay: can(actor, "expense.manage") && x.a.status === "approved" } };
}

export async function decideAdvance(companyId: number, actor: Express.AuthUser, id: number, input: DecisionInput) {
  const x = await findAdvance(companyId, id);
  if (!canDecide(actor, x.a.employee_id, x.manager_id)) throw new ForbiddenError("You can't decide this request");
  if (!["pending", "on_hold"].includes(x.a.status)) throw new BadRequestError(`This request is already ${x.a.status}`);
  const status = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "on_hold";
  await db.update(expenseAdvances).set({ status, decision_note: input.note ?? null, decided_by: actor.id, decided_at: new Date() }).where(eq(expenseAdvances.id, id));
  audit(actor, { companyId, action: "expense.advance", target: ["employee", x.a.employee_id], summary: `Advance of ${rupees(n(x.a.amount))} for ${x.name}: ${status.replace("_", " ")}` });
  void notify({
    companyId,
    to: [{ employeeId: x.a.employee_id }],
    type: "expense.advance_decided",
    title: `Your advance of ${rupees(n(x.a.amount))} is ${status === "on_hold" ? "on hold" : status}`,
    body: input.note ?? null,
    link: "/expenses/advance",
    entity: ["advance", id],
    actorId: actor.id,
  });
  return advanceDetail(companyId, actor, id);
}

export async function payAdvance(companyId: number, actor: Express.AuthUser, id: number, input: PayInput) {
  if (!can(actor, "expense.manage")) throw new ForbiddenError("Only accounts can record payments");
  const x = await findAdvance(companyId, id);
  if (x.a.status !== "approved") throw new BadRequestError("Approve it first");
  const amount = input.amount ?? n(x.a.amount);
  let loanId: number | null = null;
  // Against salary: recovered from the next payroll(s)
  if (x.a.advance_type === "salary") {
    const d = new Date(`${input.paidOn}T00:00:00Z`);
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
    const { loan } = await createLoan(
      companyId,
      actor,
      { employeeId: x.a.employee_id, kind: "salary_advance", principal: amount, emi: Math.ceil(amount / input.emiMonths), startMonth: next, reason: x.a.purpose },
      { type: "advance_request", id },
    );
    loanId = loan.id;
  }
  await db
    .update(expenseAdvances)
    .set({ status: "paid", paid_amount: String(amount), paid_on: input.paidOn, payment_ref: input.reference ?? null, paid_by: actor.id, loan_id: loanId })
    .where(eq(expenseAdvances.id, id));
  audit(actor, { companyId, action: "expense.paid", target: ["employee", x.a.employee_id], summary: `Paid advance ${rupees(amount)} to ${x.name}${loanId ? ` (recovered in ${input.emiMonths} month(s))` : ""}` });
  void notify({ companyId, to: [{ employeeId: x.a.employee_id }], type: "expense.paid", title: `Advance of ${rupees(amount)} paid`, body: input.reference ? `Ref ${input.reference}` : null, link: "/expenses/advance", actorId: actor.id });
  return advanceDetail(companyId, actor, id);
}

export async function cancelAdvance(companyId: number, actor: Express.AuthUser, id: number) {
  const x = await findAdvance(companyId, id);
  if (x.a.employee_id !== actor.employeeId && !can(actor, "expense.manage")) throw new ForbiddenError("Not yours");
  if (!["pending", "on_hold"].includes(x.a.status)) throw new BadRequestError(`It's already ${x.a.status}`);
  await db.update(expenseAdvances).set({ status: "cancelled" }).where(eq(expenseAdvances.id, id));
  return advanceDetail(companyId, actor, id);
}

export async function advanceFile(companyId: number, actor: Express.AuthUser, id: number, index: number) {
  const { advance } = await advanceDetail(companyId, actor, id);
  const f = advance.attachments[index];
  if (!f) throw new NotFoundError("File not found");
  return { url: signed(f.path), name: f.name };
}

// ---- Claims ----

function totals(i: ClaimInput) {
  const local = i.localTravel.reduce((t, l) => t + l.amount, 0);
  const intercity = i.intercityTravel.reduce((t, l) => t + l.amount, 0);
  const meals = i.breakfast + i.lunch + i.dinner;
  return { local, intercity, total: i.hotelAmount + meals + local + intercity + i.entertainmentAmount + i.otherAmount };
}

async function findClaim(companyId: number, id: number) {
  const [c] = await db
    .select({ c: expenseClaims, name: employees.name, manager_id: employees.manager_id, manager_status: sql<string | null>`(select m.status from employees m where m.id = ${employees.manager_id})` })
    .from(expenseClaims)
    .innerJoin(employees, eq(employees.id, expenseClaims.employee_id))
    .where(and(eq(expenseClaims.company_id, companyId), eq(expenseClaims.id, id)));
  if (!c) throw new NotFoundError("Expense not found");
  return c;
}

export async function claimDetail(companyId: number, actor: Express.AuthUser, id: number) {
  const x = await findClaim(companyId, id);
  mustSee(actor, x.c.employee_id, x.manager_id);
  const lines = await db.select().from(expenseTravelLines).where(eq(expenseTravelLines.claim_id, id)).orderBy(expenseTravelLines.id);
  const [decider] = x.c.decided_by ? await db.select({ name: users.name }).from(users).where(eq(users.id, x.c.decided_by)) : [];
  const own = actor.employeeId === x.c.employee_id;
  return {
    claim: { ...x.c, employee_name: x.name, decided_by_name: decider?.name ?? null },
    localTravel: lines.filter((l) => l.kind === "local"),
    intercityTravel: lines.filter((l) => l.kind === "intercity"),
    can: {
      edit: own && ["draft", "on_hold", "rejected"].includes(x.c.status),
      decide: canDecide(actor, x.c.employee_id, x.manager_id) && ["submitted", "on_hold"].includes(x.c.status),
      pay: can(actor, "expense.manage") && x.c.status === "approved",
      delete: (own && ["draft", "rejected"].includes(x.c.status)) || (can(actor, "expense.manage") && x.c.status !== "paid"),
    },
  };
}

export async function saveClaim(companyId: number, actor: Express.AuthUser, id: number | null, input: ClaimInput & { attachments?: Attachment[] }) {
  if (!actor.employeeId) throw new ForbiddenError("Your login isn't linked to an employee");
  if (input.claimDate > localDate()) throw new BadRequestError("The expense date can't be in the future");
  const t = totals(input);
  if (input.submit && t.total <= 0) throw new BadRequestError("Enter at least one amount");
  const p = await person(companyId, actor.employeeId);
  if (id) {
    const x = await findClaim(companyId, id);
    if (x.c.employee_id !== actor.employeeId) throw new ForbiddenError("Only the employee edits their expense");
    if (!["draft", "on_hold", "rejected"].includes(x.c.status)) throw new BadRequestError(`It's already ${x.c.status}`);
  }
  const values = {
    claim_date: input.claimDate,
    trip_name: input.tripName,
    country: input.country ?? null,
    state: input.state ?? null,
    city: input.city ?? null,
    locality: input.locality ?? null,
    client_name: input.clientName ?? null,
    teammates: input.teammates ?? null,
    expense_type: input.expenseType,
    hotel_amount: String(input.hotelAmount),
    hotel_name: input.hotelName ?? null,
    hotel_description: input.hotelDescription ?? null,
    breakfast: String(input.breakfast),
    lunch: String(input.lunch),
    dinner: String(input.dinner),
    meals_description: input.mealsDescription ?? null,
    local_total: String(t.local),
    intercity_total: String(t.intercity),
    entertainment_amount: String(input.entertainmentAmount),
    entertainment_description: input.entertainmentDescription ?? null,
    other_amount: String(input.otherAmount),
    other_description: input.otherDescription ?? null,
    total: String(t.total),
    ...(input.attachments ? { attachments: checkFiles(companyId, input.attachments) } : {}),
    updated_at: new Date(),
    ...(input.submit ? { status: "submitted" as const, submitted_at: new Date(), decision_note: null } : {}),
  };
  const claimId = await db.transaction(async (tx) => {
    let cid = id;
    if (cid) await tx.update(expenseClaims).set(values).where(eq(expenseClaims.id, cid));
    else [{ id: cid }] = await tx.insert(expenseClaims).values({ company_id: companyId, employee_id: p.id, ...values }).returning({ id: expenseClaims.id });
    await tx.delete(expenseTravelLines).where(eq(expenseTravelLines.claim_id, cid!));
    const lines = [
      ...input.localTravel.map((l) => ({ ...l, kind: "local" as const })),
      ...input.intercityTravel.map((l) => ({ ...l, kind: "intercity" as const })),
    ].filter((l) => l.amount > 0 || l.from || l.to);
    if (lines.length) {
      await tx.insert(expenseTravelLines).values(lines.map((l) => ({ claim_id: cid!, kind: l.kind, travel_type: l.travelType, from_place: l.from ?? null, to_place: l.to ?? null, amount: String(l.amount), description: l.description ?? null })));
    }
    return cid!;
  });
  if (input.submit) {
    void notify({
      companyId,
      to: await approvers(companyId, p),
      type: "expense.claim",
      title: `Expense to approve: ${p.name} — ${rupees(t.total)}`,
      body: `${input.tripName} · ${input.claimDate}`,
      link: "/expenses?scope=team",
      entity: ["claim", claimId],
      actorId: actor.id,
    });
  }
  return claimDetail(companyId, actor, claimId);
}

export async function decideClaim(companyId: number, actor: Express.AuthUser, id: number, input: DecisionInput) {
  const x = await findClaim(companyId, id);
  if (!canDecide(actor, x.c.employee_id, x.manager_id)) throw new ForbiddenError("You can't decide this expense");
  if (!["submitted", "on_hold"].includes(x.c.status)) throw new BadRequestError(`It's already ${x.c.status}`);
  const status = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "on_hold";
  const approved = input.action === "approve" ? Math.min(input.approvedAmount ?? n(x.c.total), n(x.c.total)) : null;
  await db
    .update(expenseClaims)
    .set({ status, decision_note: input.note ?? null, decided_by: actor.id, decided_at: new Date(), approved_amount: approved == null ? null : String(approved) })
    .where(eq(expenseClaims.id, id));
  audit(actor, { companyId, action: "expense.claim", target: ["employee", x.c.employee_id], summary: `Expense "${x.c.trip_name}" of ${x.name} (${rupees(n(x.c.total))}): ${status.replace("_", " ")}${approved != null && approved < n(x.c.total) ? ` at ${rupees(approved)}` : ""}` });
  void notify({
    companyId,
    to: [{ employeeId: x.c.employee_id }],
    type: "expense.claim_decided",
    title: `Expense "${x.c.trip_name}" ${status === "on_hold" ? "is on hold" : status}${approved != null && approved < n(x.c.total) ? ` at ${rupees(approved)}` : ""}`,
    body: input.note ?? null,
    link: "/expenses",
    entity: ["claim", id],
    actorId: actor.id,
  });
  return claimDetail(companyId, actor, id);
}

export async function payClaim(companyId: number, actor: Express.AuthUser, id: number, input: PayInput) {
  if (!can(actor, "expense.manage")) throw new ForbiddenError("Only accounts can record payments");
  const x = await findClaim(companyId, id);
  if (x.c.status !== "approved") throw new BadRequestError("Approve it first");
  const amount = input.amount ?? n(x.c.approved_amount ?? x.c.total);
  await db.update(expenseClaims).set({ status: "paid", paid_amount: String(amount), paid_on: input.paidOn, payment_ref: input.reference ?? null, paid_by: actor.id }).where(eq(expenseClaims.id, id));
  audit(actor, { companyId, action: "expense.paid", target: ["employee", x.c.employee_id], summary: `Reimbursed ${rupees(amount)} to ${x.name} for "${x.c.trip_name}"` });
  void notify({ companyId, to: [{ employeeId: x.c.employee_id }], type: "expense.paid", title: `Reimbursed ${rupees(amount)} for "${x.c.trip_name}"`, body: input.reference ? `Ref ${input.reference}` : null, link: "/expenses", actorId: actor.id });
  return claimDetail(companyId, actor, id);
}

export async function deleteClaim(companyId: number, actor: Express.AuthUser, id: number) {
  const d = await claimDetail(companyId, actor, id);
  if (!d.can.delete) throw new BadRequestError("This expense can't be deleted");
  await db.delete(expenseClaims).where(eq(expenseClaims.id, id));
}

export async function claimFile(companyId: number, actor: Express.AuthUser, id: number, index: number) {
  const { claim } = await claimDetail(companyId, actor, id);
  const f = claim.attachments[index];
  if (!f) throw new NotFoundError("File not found");
  return { url: signed(f.path), name: f.name };
}

// ---- Balance (TA/DA) ----

const monthStart = (m: string) => `${m}-01`;
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
};

export async function balance(companyId: number, actor: Express.AuthUser, employeeId: number | undefined, month: string | undefined) {
  const who = employeeId ?? actor.employeeId;
  if (!who) return { balance: null };
  if (who !== actor.employeeId) {
    const p = await person(companyId, who);
    mustSee(actor, who, p.manager_id);
  }
  const m = month ?? localDate().slice(0, 7);
  const from = monthStart(m);
  const to = nextMonth(m);
  const [row] = (
    await db.execute<{ adv_before: string; exp_before: string; paid_before: string; adv_month: string; exp_month: string; paid_month: string }>(sql`select
      (select coalesce(sum(paid_amount), 0) from expense_advances where company_id = ${companyId} and employee_id = ${who} and advance_type = 'tada' and status = 'paid' and paid_on < ${from}::date)::text as adv_before,
      (select coalesce(sum(coalesce(approved_amount, total)), 0) from expense_claims where company_id = ${companyId} and employee_id = ${who} and status in ('approved', 'paid') and claim_date < ${from}::date)::text as exp_before,
      (select coalesce(sum(paid_amount), 0) from expense_claims where company_id = ${companyId} and employee_id = ${who} and status = 'paid' and paid_on < ${from}::date)::text as paid_before,
      (select coalesce(sum(paid_amount), 0) from expense_advances where company_id = ${companyId} and employee_id = ${who} and advance_type = 'tada' and status = 'paid' and paid_on >= ${from}::date and paid_on < ${to}::date)::text as adv_month,
      (select coalesce(sum(coalesce(approved_amount, total)), 0) from expense_claims where company_id = ${companyId} and employee_id = ${who} and status in ('approved', 'paid') and claim_date >= ${from}::date and claim_date < ${to}::date)::text as exp_month,
      (select coalesce(sum(paid_amount), 0) from expense_claims where company_id = ${companyId} and employee_id = ${who} and status = 'paid' and paid_on >= ${from}::date and paid_on < ${to}::date)::text as paid_month`)
  ).rows;
  const [last] = await db
    .select({ amount: expenseClaims.paid_amount, on: expenseClaims.paid_on })
    .from(expenseClaims)
    .where(and(eq(expenseClaims.company_id, companyId), eq(expenseClaims.employee_id, who), eq(expenseClaims.status, "paid")))
    .orderBy(desc(expenseClaims.paid_on), desc(expenseClaims.id))
    .limit(1);
  const opening = n(row.adv_before) - n(row.exp_before) + n(row.paid_before);
  const closing = opening + n(row.adv_month) - n(row.exp_month) + n(row.paid_month);
  return {
    balance: {
      employeeId: who,
      month: m,
      opening,
      monthAdvance: n(row.adv_month),
      monthExpense: n(row.exp_month),
      monthPaid: n(row.paid_month),
      lastPaid: last ? n(last.amount) : 0,
      lastPaidOn: last?.on ?? null,
      closing,
    },
  };
}

// ---- View Expense: one list of claims and advances ----

export async function listExpenses(companyId: number, actor: Express.AuthUser, q: ListQuery) {
  const manage = can(actor, "expense.manage");
  if (q.scope === "all" && !manage) throw new ForbiddenError("You can only see your own and your team's expenses");
  // Whose rows: me / people who report to me / everyone
  const people = db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.company_id, companyId),
        q.scope === "mine" ? eq(employees.id, actor.employeeId ?? -1) : q.scope === "team" ? (manage ? undefined : eq(employees.manager_id, actor.employeeId ?? -1)) : undefined,
        q.scope === "team" && manage ? sql`${employees.id} <> ${actor.employeeId ?? -1}` : undefined,
        q.employeeId ? eq(employees.id, q.employeeId) : undefined,
        q.departmentId ? eq(employees.department_id, q.departmentId) : undefined,
        q.branchId ? eq(employees.branch_id, q.branchId) : undefined,
      ),
    );
  const range = q.month ? { from: monthStart(q.month), to: nextMonth(q.month) } : null;

  const claims =
    q.kind === "advances"
      ? []
      : await db
          .select({ c: expenseClaims, name: employees.name, code: employees.employee_code, manager_id: employees.manager_id, department: departments.name })
          .from(expenseClaims)
          .innerJoin(employees, eq(employees.id, expenseClaims.employee_id))
          .leftJoin(departments, eq(departments.id, employees.department_id))
          .where(
            and(
              eq(expenseClaims.company_id, companyId),
              inArray(expenseClaims.employee_id, people),
              range ? and(gte(expenseClaims.claim_date, range.from), lt(expenseClaims.claim_date, range.to)) : undefined,
              q.status ? eq(expenseClaims.status, q.status as "draft") : undefined,
              // Others' drafts stay private
              q.scope === "mine" ? undefined : sql`${expenseClaims.status} <> 'draft'`,
            ),
          );
  const advances =
    q.kind === "claims"
      ? []
      : await db
          .select({ a: expenseAdvances, name: employees.name, code: employees.employee_code, manager_id: employees.manager_id, department: departments.name })
          .from(expenseAdvances)
          .innerJoin(employees, eq(employees.id, expenseAdvances.employee_id))
          .leftJoin(departments, eq(departments.id, employees.department_id))
          .where(
            and(
              eq(expenseAdvances.company_id, companyId),
              inArray(expenseAdvances.employee_id, people),
              range ? and(gte(sql`(${expenseAdvances.created_at} at time zone 'Asia/Kolkata')::date`, range.from), lt(sql`(${expenseAdvances.created_at} at time zone 'Asia/Kolkata')::date`, range.to)) : undefined,
              q.status ? eq(expenseAdvances.status, q.status as "pending") : undefined,
            ),
          );

  const rows = [
    ...claims.map(({ c, name, code, manager_id, department }) => ({
      kind: "claim" as const,
      id: c.id,
      employee_id: c.employee_id,
      employee_name: name,
      employee_code: code,
      department,
      title: c.trip_name,
      date: c.claim_date,
      hotel: n(c.hotel_amount),
      meals: n(c.breakfast) + n(c.lunch) + n(c.dinner),
      local: n(c.local_total),
      intercity: n(c.intercity_total),
      entertainment: n(c.entertainment_amount),
      others: n(c.other_amount),
      total: n(c.total),
      approved: c.approved_amount == null ? null : n(c.approved_amount),
      status: c.status,
      files: c.attachments.length,
      can_decide: canDecide(actor, c.employee_id, manager_id) && ["submitted", "on_hold"].includes(c.status),
      can_pay: manage && c.status === "approved",
      can_delete: (actor.employeeId === c.employee_id && ["draft", "rejected"].includes(c.status)) || (manage && c.status !== "paid"),
    })),
    ...advances.map(({ a, name, code, manager_id, department }) => ({
      kind: "advance" as const,
      id: a.id,
      employee_id: a.employee_id,
      employee_name: name,
      employee_code: code,
      department,
      title: `${a.advance_type === "salary" ? "Salary advance" : "TA/DA advance"} — ${a.purpose}`,
      date: localDate(a.created_at ?? new Date()),
      hotel: 0,
      meals: 0,
      local: 0,
      intercity: 0,
      entertainment: 0,
      others: 0,
      total: n(a.amount),
      approved: null,
      status: a.status,
      files: a.attachments.length,
      can_decide: canDecide(actor, a.employee_id, manager_id) && ["pending", "on_hold"].includes(a.status),
      can_pay: manage && a.status === "approved",
      can_delete: false,
    })),
  ].sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id);

  const start = (q.page - 1) * q.limit;
  return {
    rows: rows.slice(start, start + q.limit),
    total: rows.length,
    page: q.page,
    limit: q.limit,
    grandTotal: rows.reduce((t, r) => t + r.total, 0),
    canManage: manage,
    all: rows, // for the Excel export (not sent to the browser)
  };
}

export async function teamMembers(companyId: number, actor: Express.AuthUser) {
  const manage = can(actor, "expense.manage");
  const rows = await db
    .select({ id: employees.id, name: employees.name, code: employees.employee_code })
    .from(employees)
    .where(and(eq(employees.company_id, companyId), manage ? undefined : eq(employees.manager_id, actor.employeeId ?? -1)))
    .orderBy(employees.name);
  return { people: rows };
}
