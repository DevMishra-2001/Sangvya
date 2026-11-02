import { boolean, date, integer, numeric, pgTable, smallint, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

export const SETTLEMENT_STATUSES = ["pending", "approved", "paid"] as const;

// One per exit in progress: interview + full & final settlement (notice / reason live on employees)
export const employeeExits = pgTable(
  "employee_exits",
  {
    employee_id: integer("employee_id").primaryKey(),
    company_id: integer("company_id").notNull(),
    started_on: date("started_on"),
    interview_notes: text("interview_notes"),
    interview_rating: smallint("interview_rating"), // 1–5: how was working here
    would_rejoin: boolean("would_rejoin"),
    last_salary: numeric("last_salary", { precision: 12, scale: 2 }),
    leave_encashment: numeric("leave_encashment", { precision: 12, scale: 2 }),
    bonus: numeric("bonus", { precision: 12, scale: 2 }),
    notice_recovery: numeric("notice_recovery", { precision: 12, scale: 2 }),
    other_deductions: numeric("other_deductions", { precision: 12, scale: 2 }),
    settlement_notes: text("settlement_notes"),
    settlement_status: varchar("settlement_status", { length: 10 }).notNull().default("pending").$type<(typeof SETTLEMENT_STATUSES)[number]>(),
    settled_on: date("settled_on"),
    completed_at: timestamptz("completed_at"),
    created_at: createdAt(),
  },
  (t) => [fk("employee_exits", t.employee_id, employees.id, "cascade"), fk("employee_exits", t.company_id, companies.id, "cascade")],
);

// Clearance checklist of an exit (assets are checked live from asset_assignments)
export const exitClearances = pgTable(
  "exit_clearances",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    item_key: varchar("item_key", { length: 30 }).notNull(),
    label: varchar("label", { length: 100 }).notNull(),
    done: boolean("done").notNull().default(false),
    done_by: integer("done_by"),
    done_at: timestamptz("done_at"),
    notes: text("notes"),
    created_at: createdAt(),
  },
  (t) => [
    fk("exit_clearances", t.company_id, companies.id, "cascade"),
    fk("exit_clearances", t.employee_id, employees.id, "cascade"),
    fk("exit_clearances", t.done_by, users.id, "set null"),
    uniqueIndex("idx_exit_clearances_item").on(t.employee_id, t.item_key),
  ],
);
