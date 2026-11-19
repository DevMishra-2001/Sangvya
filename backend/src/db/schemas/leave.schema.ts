import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgTable, smallint, text, unique, varchar } from "drizzle-orm/pg-core";
import { auditColumns, auditFks } from "../auditColumns.js";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    from_date: date("from_date").notNull(),
    to_date: date("to_date").notNull(),
    reason: text("reason"),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | approved | rejected | cancelled
    created_at: createdAt(),
    // leave (legacy) | cl | sl | ol | el | comp_off
    leave_type: varchar("leave_type", { length: 20 }).notNull().default("leave"),
    reviewed_by: integer("reviewed_by"),
    reviewed_at: timestamptz("reviewed_at"),
    // A one-day leave for half the day: "first" | "second" (counts 0.5)
    half_day: varchar("half_day", { length: 10 }).$type<"first" | "second">(),
    // The approver's note to the employee (why approved / rejected)
    review_note: text("review_note"),
    // Withdrawn by the employee, or cancelled by HR — the days go back to the balance
    cancelled_by: integer("cancelled_by"),
    cancelled_at: timestamptz("cancelled_at"),
    // Supporting documents (e.g. a medical certificate), uploaded first
    attachments: jsonb("attachments").$type<{ path: string; name: string }[]>().notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [
    fk("leave_requests", t.company_id, companies.id, "cascade"),
    fk("leave_requests", t.employee_id, employees.id, "cascade"),
    fk("leave_requests", t.reviewed_by, users.id, "set null"),
    fk("leave_requests", t.cancelled_by, users.id, "set null"),
    index("idx_leave_company_status").on(t.company_id, t.status),
  ],
);

// Company leave quotas. The leave year is the financial year (April–March).
//   CL: per year, lapses at year end
//   SL: per year, unused days carry forward to the next year
//   OL: per year, default for employees without their own number (employees.ol_quota)
//   EL: per month, unused days are paid out (encashed) at month end
export const leavePolicies = pgTable(
  "leave_policies",
  {
    company_id: integer("company_id").primaryKey(),
    cl_per_year: numeric("cl_per_year", { precision: 5, scale: 1 }).notNull().default("6"),
    sl_per_year: numeric("sl_per_year", { precision: 5, scale: 1 }).notNull().default("6"),
    ol_per_year: numeric("ol_per_year", { precision: 5, scale: 1 }).notNull().default("2"),
    el_per_month: numeric("el_per_month", { precision: 5, scale: 1 }).notNull().default("1"),
    // A comp off earned on a holiday / weekly off can be used within this many days
    comp_off_valid_days: smallint("comp_off_valid_days").notNull().default(90),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [fk("leave_policies", t.company_id, companies.id, "cascade")],
);

// Leave types per company (Leave Settings). leave_requests.leave_type holds the code.
//   kind quota    a balance from a quota per year / month (or no limit)
//   kind comp_off earned by working a weekly off / holiday
//   kind unpaid   no balance; payroll counts the days as loss of pay
export const leaveTypes = pgTable(
  "leave_types",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    short_name: varchar("short_name", { length: 12 }).notNull(),
    color: varchar("color", { length: 9 }).notNull().default("#2563eb"),
    kind: varchar("kind", { length: 10 }).notNull().default("quota"),
    is_paid: boolean("is_paid").notNull().default(true),
    quota: numeric("quota", { precision: 5, scale: 1 }).notNull().default("0"),
    quota_period: varchar("quota_period", { length: 6 }).notNull().default("year"), // year | month | none (no limit)
    carry_forward: varchar("carry_forward", { length: 4 }).notNull().default("none"), // none | all | max
    carry_max: numeric("carry_max", { precision: 5, scale: 1 }),
    allow_half_day: boolean("allow_half_day").notNull().default(true),
    gender: varchar("gender", { length: 6 }).notNull().default("all"), // all | female | male
    after_probation: boolean("after_probation").notNull().default(false),
    min_notice_days: smallint("min_notice_days"),
    max_days_per_request: numeric("max_days_per_request", { precision: 5, scale: 1 }),
    document_after_days: numeric("document_after_days", { precision: 5, scale: 1 }),
    optional_holidays_only: boolean("optional_holidays_only").notNull().default(false),
    is_system: boolean("is_system").notNull().default(false), // built-in: code can't change
    is_active: boolean("is_active").notNull().default(true),
    sort_order: smallint("sort_order").notNull().default(0),
    ...auditColumns(),
  },
  (t) => [fk("leave_types", t.company_id, companies.id, "cascade"), ...auditFks("leave_types", t), unique("leave_types_company_code_key").on(t.company_id, t.code)],
);

// Leave rules per company (Leave Settings → Rules)
export const leaveSettings = pgTable(
  "leave_settings",
  {
    company_id: integer("company_id").primaryKey(),
    sandwich_rule: boolean("sandwich_rule").notNull().default(false), // weekly offs / holidays between leave days count as leave
    backdated_days: smallint("backdated_days"), // how far back people can apply; null = any
    when_short: varchar("when_short", { length: 6 }).notNull().default("block"), // block | unpaid
    comp_off_valid_days: smallint("comp_off_valid_days").notNull().default(90),
    comp_off_full_minutes: smallint("comp_off_full_minutes").notNull().default(0), // 0 = any check-in earns a full day
    comp_off_half_minutes: smallint("comp_off_half_minutes").notNull().default(0), // 0 = no half comp off
    ...auditColumns(),
  },
  (t) => [fk("leave_settings", t.company_id, companies.id, "cascade"), ...auditFks("leave_settings", t)],
);
