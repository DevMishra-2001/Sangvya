import { sql } from "drizzle-orm";
import { boolean, date, index, integer, numeric, pgTable, unique, varchar } from "drizzle-orm/pg-core";
import { users } from "./user.schema.js";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

// One active structure per employee at a time; a new effective_from row
// represents a revision/increment without losing history.
export const salaryStructures = pgTable(
  "salary_structures",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    basic: money("basic").notNull(),
    hra: money("hra").notNull().default("0"),
    allowances: money("allowances").notNull().default("0"),
    effective_from: date("effective_from").notNull().default(sql`CURRENT_DATE`),
    created_at: createdAt(),
  },
  (t) => [
    fk("salary_structures", t.company_id, companies.id, "cascade"),
    fk("salary_structures", t.employee_id, employees.id, "cascade"),
    index("idx_salary_structures_employee").on(t.employee_id, t.effective_from.desc().nullsFirst()),
  ],
);

// One row per company per month/year — "payroll for Sept 2026 was run".
export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    status: varchar("status", { length: 20 }).$type<"draft" | "finalized">().notNull().default("draft"), // draft: can recalculate / delete
    run_at: timestamptz("run_at").defaultNow(),
    finalized_at: timestamptz("finalized_at"),
    finalized_by: integer("finalized_by"),
  },
  (t) => [
    fk("payroll_runs", t.company_id, companies.id, "cascade"),
    fk("payroll_runs", t.finalized_by, users.id, "set null"),
    unique("payroll_runs_company_id_month_year_key").on(t.company_id, t.month, t.year),
  ],
);

// One row per employee per payroll run — the actual computed payslip.
export const payslips = pgTable(
  "payslips",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    payroll_run_id: integer("payroll_run_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    basic: money("basic").notNull(),
    hra: money("hra").notNull(),
    allowances: money("allowances").notNull(),
    gross: money("gross").notNull(),
    paid_days: numeric("paid_days", { precision: 5, scale: 2 }).notNull(),
    lop_days: numeric("lop_days", { precision: 5, scale: 2 }).notNull().default("0"), // loss of pay
    total_days: integer("total_days").notNull(),
    pf_employee: money("pf_employee").notNull().default("0"),
    pf_employer: money("pf_employer").notNull().default("0"),
    esi_employee: money("esi_employee").notNull().default("0"),
    esi_employer: money("esi_employer").notNull().default("0"),
    professional_tax: money("professional_tax").notNull().default("0"),
    tds: money("tds").notNull().default("0"),
    total_deductions: money("total_deductions").notNull(),
    net_pay: money("net_pay").notNull(),
    created_at: createdAt(),
  },
  (t) => [
    fk("payslips", t.company_id, companies.id, "cascade"),
    fk("payslips", t.payroll_run_id, payrollRuns.id, "cascade"),
    fk("payslips", t.employee_id, employees.id, "cascade"),
    unique("payslips_payroll_run_id_employee_id_key").on(t.payroll_run_id, t.employee_id),
    index("idx_payslips_company_run").on(t.company_id, t.payroll_run_id),
  ],
);

// Which statutory deductions a company applies (not every company is registered for PF / ESI)
export const payrollSettings = pgTable(
  "payroll_settings",
  {
    company_id: integer("company_id").primaryKey(),
    pf_enabled: boolean("pf_enabled").notNull().default(true),
    esi_enabled: boolean("esi_enabled").notNull().default(true),
    pt_enabled: boolean("pt_enabled").notNull().default(true),
    tds_enabled: boolean("tds_enabled").notNull().default(true),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [fk("payroll_settings", t.company_id, companies.id, "cascade")],
);
