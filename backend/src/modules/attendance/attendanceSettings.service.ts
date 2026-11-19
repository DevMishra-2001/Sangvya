// Attendance Settings: one row per company, created with the defaults the first time it's read
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { attendanceSettings, companies, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { stamp } from "../../utils/stamp.js";
import type { AttendanceSettingsInput } from "./attendance.schema.js";

export type AttendanceSettings = typeof attendanceSettings.$inferSelect;

export async function getAttendanceSettings(companyId: number): Promise<AttendanceSettings> {
  const [found] = await db.select().from(attendanceSettings).where(eq(attendanceSettings.company_id, companyId));
  if (found) return found;
  // Server-wide values from .env become the company's starting point
  await db
    .insert(attendanceSettings)
    .values({ company_id: companyId, default_required_minutes: Math.round(env.REQUIRED_WORK_HOURS * 60), default_break_minutes: env.MAX_BREAK_MINUTES })
    .onConflictDoNothing();
  const [row] = await db.select().from(attendanceSettings).where(eq(attendanceSettings.company_id, companyId));
  return row!;
}

const createdBy = alias(users, "created_by_user");
const updatedBy = alias(users, "updated_by_user");

// The settings page: rules + the company's working days + who changed them
export async function attendanceSettingsView(companyId: number) {
  await getAttendanceSettings(companyId);
  const [row] = await db
    .select({ settings: attendanceSettings, work_days: companies.work_days, created_by_name: createdBy.name, updated_by_name: updatedBy.name })
    .from(attendanceSettings)
    .innerJoin(companies, eq(companies.id, attendanceSettings.company_id))
    .leftJoin(createdBy, eq(createdBy.id, attendanceSettings.created_by))
    .leftJoin(updatedBy, eq(updatedBy.id, attendanceSettings.updated_by))
    .where(eq(attendanceSettings.company_id, companyId));
  return {
    settings: { ...row!.settings, created_by_name: row!.created_by_name, updated_by_name: row!.updated_by_name },
    workDays: (row!.work_days ?? "mon,tue,wed,thu,fri,sat").split(",").filter(Boolean),
  };
}

export async function saveAttendanceSettings(companyId: number, actor: Express.AuthUser, input: AttendanceSettingsInput) {
  await getAttendanceSettings(companyId);
  const { workDays, offSaturdays, ...rest } = input;
  await db.transaction(async (tx) => {
    await tx
      .update(attendanceSettings)
      .set({
        default_required_minutes: rest.defaultRequiredMinutes,
        default_break_minutes: rest.defaultBreakMinutes,
        status_by_hours: rest.statusByHours,
        half_day_below_minutes: rest.halfDayBelowMinutes,
        absent_below_minutes: rest.absentBelowMinutes,
        late_penalty_enabled: rest.latePenaltyEnabled,
        late_marks_per_penalty: rest.lateMarksPerPenalty,
        late_penalty: rest.latePenalty,
        count_early_leaving: rest.countEarlyLeaving,
        early_leaving_grace_minutes: rest.earlyLeavingGraceMinutes,
        off_saturdays: offSaturdays.length && workDays.includes("sat") ? [...offSaturdays].sort().join(",") : null,
        photo_rule: rest.photoRule,
        location_rule: rest.locationRule,
        geofence_enabled: rest.geofenceEnabled,
        early_check_in_minutes: rest.earlyCheckInMinutes ?? null,
        missing_checkout: rest.missingCheckout,
        corrections_enabled: rest.correctionsEnabled,
        correction_days_back: rest.correctionDaysBack,
        corrections_per_month: rest.correctionsPerMonth ?? null,
        overtime_enabled: rest.overtimeEnabled,
        overtime_after_minutes: rest.overtimeAfterMinutes,
        ...stamp.updated(actor),
      })
      .where(eq(attendanceSettings.company_id, companyId));
    await tx.update(companies).set({ work_days: workDays.join(",") }).where(eq(companies.id, companyId));
  });
  audit(actor, { companyId, action: "attendance.settings.update", summary: "Changed attendance settings" });
  return attendanceSettingsView(companyId);
}

// "2,4" → [2, 4]: which Saturdays of the month are off
export const offSaturdayWeeks = (s: Pick<AttendanceSettings, "off_saturdays"> | null | undefined) =>
  (s?.off_saturdays ?? "")
    .split(",")
    .map(Number)
    .filter((n) => n >= 1 && n <= 5);
