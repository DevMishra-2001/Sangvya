// Leave Settings: the company's leave types and leave rules
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { companies, leaveSettings, leaveTypes, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/httpErrors.js";
import { stamp } from "../../utils/stamp.js";
import { leaveRulesOf, leaveTypesOf } from "./leaveBalance.service.js";
import type { LeaveRulesInput, LeaveTypeInput } from "./leaves.schema.js";

const createdBy = alias(users, "created_by_user");
const updatedBy = alias(users, "updated_by_user");

// Everyone: the types to apply for and to label requests with
export async function publicLeaveTypes(companyId: number) {
  const types = await leaveTypesOf(companyId);
  return {
    types: types.map((t) => ({
      code: t.code,
      name: t.name,
      short_name: t.short_name,
      color: t.color,
      kind: t.kind,
      is_paid: t.is_paid,
      quota_period: t.quota_period,
      allow_half_day: t.allow_half_day,
      document_after_days: t.document_after_days == null ? null : Number(t.document_after_days),
      is_active: t.is_active,
    })),
  };
}

export async function leaveSettingsView(companyId: number) {
  await Promise.all([leaveTypesOf(companyId), leaveRulesOf(companyId)]);
  const [types, [rules], [company]] = await Promise.all([
    db
      .select({
        ...getTableColumns(leaveTypes),
        created_by_name: createdBy.name,
        updated_by_name: updatedBy.name,
        requests: sql<number>`(select count(*)::int from leave_requests r where r.company_id = "leave_types"."company_id" and r.leave_type = "leave_types"."code")`,
      })
      .from(leaveTypes)
      .leftJoin(createdBy, eq(createdBy.id, leaveTypes.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, leaveTypes.updated_by))
      .where(eq(leaveTypes.company_id, companyId))
      .orderBy(leaveTypes.sort_order, leaveTypes.id),
    db
      .select({ ...getTableColumns(leaveSettings), created_by_name: createdBy.name, updated_by_name: updatedBy.name })
      .from(leaveSettings)
      .leftJoin(createdBy, eq(createdBy.id, leaveSettings.created_by))
      .leftJoin(updatedBy, eq(updatedBy.id, leaveSettings.updated_by))
      .where(eq(leaveSettings.company_id, companyId)),
    db.select({ leave_year: companies.leave_year }).from(companies).where(eq(companies.id, companyId)),
  ]);
  return { types, rules: { ...rules!, leave_year: company?.leave_year === "calendar" ? "calendar" : "financial" } };
}

const isUnique = (e: unknown) => (e as { cause?: { code?: string }; code?: string }).cause?.code === "23505" || (e as { code?: string }).code === "23505";

export async function saveLeaveType(companyId: number, actor: Express.AuthUser, id: number | null, input: LeaveTypeInput) {
  const types = await leaveTypesOf(companyId);
  const current = id ? types.find((t) => t.id === id) : null;
  if (id && !current) throw new NotFoundError("That leave type no longer exists");
  // Built-in types keep their code (old requests point at it) and what they are
  const code = current?.is_system ? current.code : input.code;
  const kind = current?.is_system ? current.kind : input.kind;
  if (kind === "comp_off" && types.some((t) => t.kind === "comp_off" && t.id !== id)) throw new BadRequestError("There's already a comp-off type");
  const row = {
    code,
    name: input.name,
    short_name: input.shortName,
    color: input.color,
    kind,
    is_paid: kind === "unpaid" ? false : input.isPaid,
    quota: String(kind === "quota" ? input.quota : 0),
    quota_period: kind === "quota" ? input.quotaPeriod : "none",
    carry_forward: kind === "quota" && input.quotaPeriod === "year" ? input.carryForward : "none",
    carry_max: kind === "quota" && input.quotaPeriod === "year" && input.carryForward === "max" && input.carryMax != null ? String(input.carryMax) : null,
    allow_half_day: input.allowHalfDay,
    gender: input.gender,
    after_probation: input.afterProbation,
    min_notice_days: input.minNoticeDays,
    max_days_per_request: input.maxDaysPerRequest == null ? null : String(input.maxDaysPerRequest),
    document_after_days: input.documentAfterDays == null ? null : String(input.documentAfterDays),
    optional_holidays_only: input.optionalHolidaysOnly,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
  try {
    const [saved] = id
      ? await db.update(leaveTypes).set({ ...row, ...stamp.updated(actor) }).where(and(eq(leaveTypes.company_id, companyId), eq(leaveTypes.id, id))).returning()
      : await db.insert(leaveTypes).values({ ...row, company_id: companyId, ...stamp.created(actor) }).returning();
    audit(actor, { companyId, action: `leave.type.${id ? "update" : "create"}`, summary: `${id ? "Changed" : "Added"} leave type ${row.name} (${row.code})` });
    return { type: saved };
  } catch (e) {
    if (isUnique(e)) throw new ConflictError("A leave type with this code already exists");
    throw e;
  }
}

export async function deleteLeaveType(companyId: number, actor: Express.AuthUser, id: number) {
  const [t] = await db.select().from(leaveTypes).where(and(eq(leaveTypes.company_id, companyId), eq(leaveTypes.id, id)));
  if (!t) throw new NotFoundError("That leave type no longer exists");
  if (t.is_system) throw new BadRequestError("Built-in leave types can't be deleted — make it inactive instead");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(sql`leave_requests`).where(sql`company_id = ${companyId} and leave_type = ${t.code}`);
  if (n > 0) throw new BadRequestError(`${n} leave request${n === 1 ? " uses" : "s use"} this type — make it inactive instead`);
  await db.delete(leaveTypes).where(eq(leaveTypes.id, id));
  audit(actor, { companyId, action: "leave.type.delete", summary: `Removed leave type ${t.name} (${t.code})` });
}

export async function saveLeaveRules(companyId: number, actor: Express.AuthUser, input: LeaveRulesInput) {
  await leaveRulesOf(companyId);
  if (input.compOffHalfMinutes > 0 && input.compOffFullMinutes > 0 && input.compOffHalfMinutes >= input.compOffFullMinutes) {
    throw new BadRequestError("Half comp-off hours must be less than full comp-off hours");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(leaveSettings)
      .set({
        sandwich_rule: input.sandwichRule,
        backdated_days: input.backdatedDays,
        when_short: input.whenShort,
        comp_off_valid_days: input.compOffValidDays,
        comp_off_full_minutes: input.compOffFullMinutes,
        comp_off_half_minutes: input.compOffHalfMinutes,
        ...stamp.updated(actor),
      })
      .where(eq(leaveSettings.company_id, companyId));
    await tx.update(companies).set({ leave_year: input.leaveYear }).where(eq(companies.id, companyId));
  });
  audit(actor, { companyId, action: "leave.settings.update", summary: "Changed leave rules" });
  return leaveSettingsView(companyId);
}
