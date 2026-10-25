import { date, index, numeric, pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
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
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | approved | rejected
    created_at: createdAt(),
    // leave (legacy) | cl | sl | ol | el | comp_off
    leave_type: varchar("leave_type", { length: 20 }).notNull().default("leave"),
    reviewed_by: integer("reviewed_by"),
    reviewed_at: timestamptz("reviewed_at"),
  },
  (t) => [
    fk("leave_requests", t.company_id, companies.id, "cascade"),
    fk("leave_requests", t.employee_id, employees.id, "cascade"),
    fk("leave_requests", t.reviewed_by, users.id, "set null"),
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
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [fk("leave_policies", t.company_id, companies.id, "cascade")],
);
