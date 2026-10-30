import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, uniqueIndex, varchar, type PgTableExtraConfigValue } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";

// A company's departments ("Engineering", "Finance") — each company keeps its own list.
export const departments = pgTable(
  "departments",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    // Short code shown in reports, e.g. ENG (optional)
    code: varchar("code", { length: 20 }),
    // The employee who heads it (optional)
    head_id: integer("head_id"),
    // Inactive = not offered for new employees; people in it stay in it
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  // Typed explicitly: departments ↔ employees reference each other
  (t): PgTableExtraConfigValue[] => [
    fk("departments", t.company_id, companies.id, "cascade"),
    fk("departments", t.head_id, employees.id, "set null"),
    index("idx_departments_company").on(t.company_id),
    // One name per company, case-insensitive
    uniqueIndex("idx_departments_name").on(t.company_id, sql`lower(${t.name})`),
  ],
);
