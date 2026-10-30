// A company's shifts.
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { employees, shifts } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { shiftLength } from "./shiftRules.js";
import type { ShiftInput } from "./shifts.schema.js";

async function listRows(companyId: number, id?: number) {
  const rows = await db
    .select({ ...shiftColumns, employee_count: sql<number>`(${count(employees.id)})::int` })
    .from(shifts)
    .leftJoin(employees, and(eq(employees.shift_id, shifts.id), ne(employees.status, "exited")))
    .where(id ? and(eq(shifts.company_id, companyId), eq(shifts.id, id)) : eq(shifts.company_id, companyId))
    .groupBy(shifts.id)
    .orderBy(sql`${shifts.is_default} desc`, asc(shifts.start_time));
  return rows.map((r) => ({ ...r, hours_minutes: shiftLength(r.start_time, r.end_time) }));
}

const shiftColumns = {
  id: shifts.id,
  name: shifts.name,
  start_time: shifts.start_time,
  end_time: shifts.end_time,
  grace_minutes: shifts.grace_minutes,
  break_minutes: shifts.break_minutes,
  is_default: shifts.is_default,
  is_active: shifts.is_active,
};

export async function listShifts(companyId: number) {
  return { shifts: await listRows(companyId) };
}

async function assertNameFree(companyId: number, name: string, id?: number) {
  const [clash] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.company_id, companyId), sql`lower(${shifts.name}) = lower(${name.trim()})`));
  if (clash && clash.id !== id) throw new ConflictError(`"${name}" already exists`);
}

const values = (input: ShiftInput) => ({
  name: input.name,
  start_time: input.startTime,
  end_time: input.endTime,
  grace_minutes: input.graceMinutes,
  break_minutes: input.breakMinutes,
  is_default: input.isDefault,
  is_active: input.isActive,
});

export async function createShift(companyId: number, actor: Express.AuthUser, input: ShiftInput) {
  await assertNameFree(companyId, input.name);
  const [{ n }] = await db.select({ n: count() }).from(shifts).where(eq(shifts.company_id, companyId));
  const makeDefault = input.isDefault || n === 0; // the first shift is the default
  const id = await db.transaction(async (tx) => {
    if (makeDefault) await tx.update(shifts).set({ is_default: false }).where(eq(shifts.company_id, companyId));
    const [row] = await tx.insert(shifts).values({ ...values(input), is_default: makeDefault, is_active: true, company_id: companyId }).returning({ id: shifts.id });
    return row.id;
  });
  audit(actor, { companyId, action: "shift.created", target: ["shift", id], summary: `Added the shift ${input.name} (${input.startTime}–${input.endTime})` });
  const [shift] = await listRows(companyId, id);
  return { shift };
}

export async function updateShift(companyId: number, actor: Express.AuthUser, id: number, input: ShiftInput) {
  const [current] = await db.select().from(shifts).where(and(eq(shifts.company_id, companyId), eq(shifts.id, id)));
  if (!current) throw new NotFoundError("Shift not found");
  await assertNameFree(companyId, input.name, id);
  if (current.is_default && !input.isDefault) throw new BadRequestError("Make another shift the default instead");
  if (current.is_default && !input.isActive) throw new BadRequestError("The default shift must stay active");
  await db.transaction(async (tx) => {
    if (input.isDefault && !current.is_default) await tx.update(shifts).set({ is_default: false }).where(eq(shifts.company_id, companyId));
    await tx.update(shifts).set(values(input)).where(eq(shifts.id, id));
  });
  audit(actor, {
    companyId,
    action: "shift.updated",
    target: ["shift", id],
    summary: `Updated the shift ${input.name} (${input.startTime}–${input.endTime})${input.isDefault && !current.is_default ? " — now the default" : ""}`,
  });
  const [shift] = await listRows(companyId, id);
  return { shift };
}

// Its employees move to the default shift (shift_id becomes NULL)
export async function deleteShift(companyId: number, actor: Express.AuthUser, id: number) {
  const [current] = await db.select().from(shifts).where(and(eq(shifts.company_id, companyId), eq(shifts.id, id)));
  if (!current) throw new NotFoundError("Shift not found");
  if (current.is_default) throw new BadRequestError("The default shift can't be removed — make another shift the default first");
  await db.delete(shifts).where(eq(shifts.id, id));
  audit(actor, { companyId, action: "shift.removed", target: ["shift", id], summary: `Removed the shift ${current.name}` });
}

// For the employee form: the shift must be this company's and active (unless they already have it)
export async function assertShiftUsable(companyId: number, id: number, currentId: number | null = null) {
  const [row] = await db.select().from(shifts).where(and(eq(shifts.company_id, companyId), eq(shifts.id, id)));
  if (!row) throw new NotFoundError("Shift not found");
  if (id !== currentId && !row.is_active) throw new BadRequestError(`"${row.name}" is inactive`);
}
