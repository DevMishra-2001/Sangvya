import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { fk, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";

export const BANK_ACCOUNT_TYPES = ["savings", "current", "salary"] as const;

// Statutory IDs and bank details — kept apart so only HR / Admin (employees.manage) ever read them
export const employeePrivate = pgTable(
  "employee_private",
  {
    employee_id: integer("employee_id").primaryKey(),
    company_id: integer("company_id").notNull(),
    pan: varchar("pan", { length: 10 }),
    aadhaar: varchar("aadhaar", { length: 12 }),
    uan: varchar("uan", { length: 12 }),
    pf_number: varchar("pf_number", { length: 30 }),
    esi_number: varchar("esi_number", { length: 17 }),
    passport_number: varchar("passport_number", { length: 20 }),
    bank_name: varchar("bank_name", { length: 120 }),
    bank_branch: varchar("bank_branch", { length: 120 }),
    ifsc: varchar("ifsc", { length: 11 }),
    account_number: varchar("account_number", { length: 18 }),
    account_holder: varchar("account_holder", { length: 150 }),
    account_type: varchar("account_type", { length: 10 }).$type<(typeof BANK_ACCOUNT_TYPES)[number]>(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [fk("employee_private", t.employee_id, employees.id, "cascade"), fk("employee_private", t.company_id, companies.id, "cascade")],
);
