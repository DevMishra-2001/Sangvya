import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, unique, varchar } from "drizzle-orm/pg-core";
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
    allowances: money("allowances").notNull().default("0"), // sum of the components below
    // Other monthly earnings: [{ label: "Special allowance", amount: 8000 }, …]
    components: jsonb("components").$type<{ label: string; amount: number }[]>().notNull().default(sql`'[]'::jsonb`),
    ctc_annual: money("ctc_annual"),
    note: text("note"), // e.g. "Annual increment 10%"
    created_by: integer("created_by"),
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
    // Line items: prorated components, one-time earnings (bonus …), reimbursements, other deductions (loan EMI …)
    earnings: jsonb("earnings").$type<{ label: string; amount: number }[]>().notNull().default(sql`'[]'::jsonb`),
    additions: money("additions").notNull().default("0"),
    addition_lines: jsonb("addition_lines").$type<{ category: string; label: string; amount: number }[]>().notNull().default(sql`'[]'::jsonb`),
    reimbursements: money("reimbursements").notNull().default("0"),
    other_deductions: money("other_deductions").notNull().default("0"),
    deduction_lines: jsonb("deduction_lines").$type<{ category: string; label: string; amount: number; loanId?: number }[]>().notNull().default(sql`'[]'::jsonb`),
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
    // PF on basic capped at ₹15,000 (statutory minimum) or on the full basic
    pf_ceiling: boolean("pf_ceiling").notNull().default(true),
    // How a CTC is split into components when HR types only the CTC
    ctc_template: jsonb("ctc_template").$type<CtcTemplate>(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [fk("payroll_settings", t.company_id, companies.id, "cascade")],
);

export interface CtcTemplate {
  basicPct: number; // % of monthly gross
  hraPctOfBasic: number; // % of basic (40 non-metro, 50 metro)
  conveyance: number; // fixed ₹ per month
  medical: number; // fixed ₹ per month
}

export const PAYROLL_ADJUSTMENT_CATEGORIES = ["bonus", "incentive", "arrears", "overtime", "reimbursement", "other_earning", "advance_recovery", "fine", "other_deduction"] as const;

// One-time items for one employee in one run (bonus, arrears, reimbursement, fine …)
export const payrollAdjustments = pgTable(
  "payroll_adjustments",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    payroll_run_id: integer("payroll_run_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    kind: varchar("kind", { length: 10 }).notNull().$type<"earning" | "deduction">(),
    category: varchar("category", { length: 30 }).notNull().$type<(typeof PAYROLL_ADJUSTMENT_CATEGORIES)[number]>(),
    label: varchar("label", { length: 120 }).notNull(),
    amount: money("amount").notNull(),
    // Where it came from (an approved expense claim …)
    source_type: varchar("source_type", { length: 20 }),
    source_id: integer("source_id"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("payroll_adjustments", t.company_id, companies.id, "cascade"),
    fk("payroll_adjustments", t.payroll_run_id, payrollRuns.id, "cascade"),
    fk("payroll_adjustments", t.employee_id, employees.id, "cascade"),
    fk("payroll_adjustments", t.created_by, users.id, "set null"),
    index("idx_payroll_adjustments_run").on(t.payroll_run_id),
  ],
);

// HR's own LOP days for someone in a run (instead of the attendance-based number)
export const payrollLopOverrides = pgTable(
  "payroll_lop_overrides",
  {
    payroll_run_id: integer("payroll_run_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    lop_days: numeric("lop_days", { precision: 5, scale: 2 }).notNull(),
    note: text("note"),
  },
  (t) => [
    primaryKey({ columns: [t.payroll_run_id, t.employee_id] }),
    fk("payroll_lop_overrides", t.payroll_run_id, payrollRuns.id, "cascade"),
    fk("payroll_lop_overrides", t.employee_id, employees.id, "cascade"),
  ],
);

// Loans and salary advances, recovered as a monthly EMI through payroll
export const employeeLoans = pgTable(
  "employee_loans",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    kind: varchar("kind", { length: 15 }).notNull().$type<"loan" | "salary_advance">(),
    principal: money("principal").notNull(),
    emi: money("emi").notNull(),
    start_month: varchar("start_month", { length: 7 }).notNull(), // "2026-11" — first payroll it's deducted in
    recovered: money("recovered").notNull().default("0"),
    status: varchar("status", { length: 10 }).notNull().default("active").$type<"active" | "closed" | "cancelled">(),
    reason: text("reason"),
    source_type: varchar("source_type", { length: 20 }), // "advance_request" when it came from Expense
    source_id: integer("source_id"),
    created_by: integer("created_by"),
    created_at: createdAt(),
    closed_at: timestamptz("closed_at"),
  },
  (t) => [
    fk("employee_loans", t.company_id, companies.id, "cascade"),
    fk("employee_loans", t.employee_id, employees.id, "cascade"),
    fk("employee_loans", t.created_by, users.id, "set null"),
    index("idx_employee_loans_company").on(t.company_id, t.status),
  ],
);

// Each EMI actually taken in a finalized payroll
export const loanRecoveries = pgTable(
  "loan_recoveries",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    loan_id: integer("loan_id").notNull(),
    payroll_run_id: integer("payroll_run_id").notNull(),
    amount: money("amount").notNull(),
    created_at: createdAt(),
  },
  (t) => [
    fk("loan_recoveries", t.company_id, companies.id, "cascade"),
    fk("loan_recoveries", t.loan_id, employeeLoans.id, "cascade"),
    fk("loan_recoveries", t.payroll_run_id, payrollRuns.id, "cascade"),
    unique("loan_recoveries_loan_run_key").on(t.loan_id, t.payroll_run_id),
  ],
);
