import { sql } from "drizzle-orm";
import { check, date, doublePrecision, index, pgTable, text, unique, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";

// One row per employee per day. HR can mark it (status only), or the employee
// punches in/out themselves (punch_* columns). punch_in = first punch in,
// punch_out = last punch out.
export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    date: date("date").notNull(),
    status: varchar("status", { length: 20 }).notNull(), // present | absent | half
    created_at: createdAt(),
    punch_in: timestamptz("punch_in"),
    punch_out: timestamptz("punch_out"),
    punch_in_location: varchar("punch_in_location", { length: 40 }),
    punch_in_remarks: text("punch_in_remarks"),
    punch_out_location: varchar("punch_out_location", { length: 40 }),
    punch_out_remarks: text("punch_out_remarks"),
    // Set once the end-of-day check (manager alert) has run for this day
    day_closed_at: timestamptz("day_closed_at"),
  },
  (t) => [
    fk("attendance", t.company_id, companies.id, "cascade"),
    fk("attendance", t.employee_id, employees.id, "cascade"),
    unique("attendance_employee_id_date_key").on(t.employee_id, t.date),
    index("idx_attendance_company_date").on(t.company_id, t.date),
  ],
);

// Any number of breaks per day; break_end is NULL while the break is running.
export const attendanceBreaks = pgTable(
  "attendance_breaks",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    attendance_id: integer("attendance_id").notNull(),
    break_start: timestamptz("break_start").notNull(),
    break_end: timestamptz("break_end"),
  },
  (t) => [
    fk("attendance_breaks", t.company_id, companies.id, "cascade"),
    fk("attendance_breaks", t.attendance_id, attendance.id, "cascade"),
    index("idx_attendance_breaks_attendance").on(t.attendance_id),
  ],
);

// Every punch (in / out) with its own location + remarks.
export const attendancePunches = pgTable(
  "attendance_punches",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    attendance_id: integer("attendance_id").notNull(),
    kind: varchar("kind", { length: 3 }).notNull().$type<"in" | "out">(),
    punched_at: timestamptz("punched_at").notNull(),
    location: varchar("location", { length: 40 }),
    remarks: text("remarks"),
    // Where the browser said the employee was (null if they denied location)
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracy_m: integer("accuracy_m"),
    // Selfie taken at the punch (ImageKit URL)
    photo_url: text("photo_url"),
    created_at: createdAt(),
  },
  (t) => [
    fk("attendance_punches", t.company_id, companies.id, "cascade"),
    fk("attendance_punches", t.attendance_id, attendance.id, "cascade"),
    index("idx_attendance_punches").on(t.attendance_id, t.punched_at),
    check("attendance_punches_kind_check", sql`${t.kind} IN ('in', 'out')`),
  ],
);

// Company holidays, set by HR/superadmin — shown on every employee's calendar.
export const holidays = pgTable(
  "holidays",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    date: date("date").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    created_at: createdAt(),
  },
  (t) => [
    fk("holidays", t.company_id, companies.id, "cascade"),
    unique("holidays_company_id_date_key").on(t.company_id, t.date),
  ],
);
