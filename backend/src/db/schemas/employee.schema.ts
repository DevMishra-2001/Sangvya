import { sql } from "drizzle-orm";
import { date, index, numeric, pgTable, text, uniqueIndex, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { departments } from "./department.schema.js";
import { designations } from "./designation.schema.js";
import { roles } from "./role.schema.js";
import { branches } from "./branch.schema.js";
import { shifts } from "./shift.schema.js";

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYEE_STATUSES = ["active", "notice", "exited"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];
export const WORK_MODES = ["office", "remote", "hybrid", "field"] as const;
export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const EXIT_REASONS = ["resigned", "terminated", "retired", "contract_end", "absconded", "other"] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

export const employees = pgTable(
  "employees",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    // Job title, from the company's designations list (no effect on access)
    designation_id: integer("designation_id"),
    // System role — what they can open and do (Page Master)
    role_id: integer("role_id"),
    // Department, from the company's departments list
    department_id: integer("department_id"),
    // Working hours; NULL = the company's default shift
    shift_id: integer("shift_id"),
    email: varchar("email", { length: 150 }),
    join_date: date("join_date"),
    salary: numeric("salary", { precision: 12, scale: 2 }),
    created_at: createdAt(),
    // Who this employee reports to — their manager approves leave and gets attendance alerts
    manager_id: integer("manager_id"),
    date_of_birth: date("date_of_birth"),
    // Optional leaves per year; NULL = company default
    ol_quota: numeric("ol_quota", { precision: 5, scale: 1 }),
    // Company-assigned employee code (e.g. IISPL25888), unique within a company
    employee_code: varchar("employee_code", { length: 40 }),
    // Profile photo (ImageKit URL)
    photo_url: text("photo_url"),
    phone: varchar("phone", { length: 30 }),
    gender: varchar("gender", { length: 10 }).$type<"male" | "female" | "other">(),
    address: text("address"),
    // full_time | part_time | contract | intern
    employment_type: varchar("employment_type", { length: 20 }).$type<EmploymentType>().notNull().default("full_time"),
    // active | notice (leaving: exit_date is their last working day) | exited
    status: varchar("status", { length: 20 }).$type<EmployeeStatus>().notNull().default("active"),
    exit_date: date("exit_date"),
    exit_reason: varchar("exit_reason", { length: 30 }).$type<ExitReason>(),
    exit_notes: text("exit_notes"),
    exited_at: timestamptz("exited_at"),
    emergency_contact_name: varchar("emergency_contact_name", { length: 150 }),
    emergency_contact_phone: varchar("emergency_contact_phone", { length: 30 }),
    emergency_contact_relation: varchar("emergency_contact_relation", { length: 30 }),
    // Personal
    personal_email: varchar("personal_email", { length: 150 }),
    marital_status: varchar("marital_status", { length: 10 }).$type<(typeof MARITAL_STATUSES)[number]>(),
    blood_group: varchar("blood_group", { length: 3 }).$type<(typeof BLOOD_GROUPS)[number]>(),
    nationality: varchar("nationality", { length: 60 }),
    // Address (address = line 1)
    address_line2: text("address_line2"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    postal_code: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 100 }),
    // Employment
    branch_id: integer("branch_id"),
    business_unit: varchar("business_unit", { length: 100 }),
    work_mode: varchar("work_mode", { length: 10 }).$type<(typeof WORK_MODES)[number]>(),
    probation_end_date: date("probation_end_date"),
  },
  (t) => [
    fk("employees", t.company_id, companies.id, "cascade"),
    fk("employees", t.manager_id, t.id, "set null"),
    fk("employees", t.designation_id, designations.id, "set null"),
    fk("employees", t.role_id, roles.id, "set null"),
    fk("employees", t.department_id, departments.id, "set null"),
    fk("employees", t.shift_id, shifts.id, "set null"),
    fk("employees", t.branch_id, branches.id, "set null"),
    index("idx_employees_company").on(t.company_id),
    // Case-insensitive code uniqueness. drizzle-kit can't compare expression
    // indexes, so `db:push` re-creates this one each time (same definition).
    uniqueIndex("idx_employees_code")
      .on(t.company_id, sql`lower(${t.employee_code})`)
      .where(sql`${t.employee_code} IS NOT NULL`),
  ],
);
