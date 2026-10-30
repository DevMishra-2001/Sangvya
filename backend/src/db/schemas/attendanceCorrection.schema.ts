import { date, index, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

// An employee asking to fix a past day's check-in / check-out (forgot to check out, network issue, client visit…).
export const attendanceCorrections = pgTable(
  "attendance_corrections",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    date: date("date").notNull(),
    punch_in: timestamptz("punch_in").notNull(),
    punch_out: timestamptz("punch_out").notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 20 }).$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
    reviewed_by: integer("reviewed_by"),
    reviewed_at: timestamptz("reviewed_at"),
    review_note: text("review_note"),
    created_at: createdAt(),
  },
  (t) => [
    fk("attendance_corrections", t.company_id, companies.id, "cascade"),
    fk("attendance_corrections", t.employee_id, employees.id, "cascade"),
    fk("attendance_corrections", t.reviewed_by, users.id, "set null"),
    index("idx_attendance_corrections_company").on(t.company_id, t.status),
    index("idx_attendance_corrections_employee").on(t.employee_id, t.date),
  ],
);
