import { boolean, integer, pgTable, smallint, varchar } from "drizzle-orm/pg-core";
import { auditColumns, auditFks } from "../auditColumns.js";
import { fk } from "../columns.js";
import { companies } from "./company.schema.js";

// Attendance rules per company (Attendance Settings). Defaults keep the app's earlier behaviour.
export const attendanceSettings = pgTable(
  "attendance_settings",
  {
    company_id: integer("company_id").primaryKey(),
    // Work hours when the employee has no shift (shifts set their own)
    default_required_minutes: smallint("default_required_minutes").notNull().default(540),
    default_break_minutes: smallint("default_break_minutes").notNull().default(60),
    // Day status from the time worked, decided when the day closes
    status_by_hours: boolean("status_by_hours").notNull().default(false),
    half_day_below_minutes: smallint("half_day_below_minutes").notNull().default(270),
    absent_below_minutes: smallint("absent_below_minutes").notNull().default(120),
    // Late / early leaving: every N marks in a month cut a half or full day in payroll
    late_penalty_enabled: boolean("late_penalty_enabled").notNull().default(false),
    late_marks_per_penalty: smallint("late_marks_per_penalty").notNull().default(3),
    late_penalty: varchar("late_penalty", { length: 4 }).notNull().default("half"), // half | full
    count_early_leaving: boolean("count_early_leaving").notNull().default(false),
    early_leaving_grace_minutes: smallint("early_leaving_grace_minutes").notNull().default(0),
    // Saturdays off by week of the month ("2,4" = 2nd and 4th) when Saturday is a working day
    off_saturdays: varchar("off_saturdays", { length: 12 }),
    // Check-in
    photo_rule: varchar("photo_rule", { length: 10 }).notNull().default("optional"), // required | optional | off
    location_rule: varchar("location_rule", { length: 10 }).notNull().default("optional"), // required | optional
    geofence_enabled: boolean("geofence_enabled").notNull().default(true), // branch radius check for office check-in
    early_check_in_minutes: smallint("early_check_in_minutes"), // null = any time
    missing_checkout: varchar("missing_checkout", { length: 10 }).notNull().default("flag"), // flag | shift_end | half
    // Corrections (regularisation)
    corrections_enabled: boolean("corrections_enabled").notNull().default(true),
    correction_days_back: smallint("correction_days_back").notNull().default(30),
    corrections_per_month: smallint("corrections_per_month"), // null = no limit
    // Overtime: time beyond the day's required hours, counted after this many minutes
    overtime_enabled: boolean("overtime_enabled").notNull().default(false),
    overtime_after_minutes: smallint("overtime_after_minutes").notNull().default(30),
    ...auditColumns(),
  },
  (t) => [fk("attendance_settings", t.company_id, companies.id, "cascade"), ...auditFks("attendance_settings", t)],
);
