import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, smallint, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";

// System roles — what a person can DO in the app (their job title is a separate,
// company-defined designation). Highest first; `level` stops anyone from giving
// a role above their own.
//   superadmin — the platform developer (set in the DB, never from the app)
//   admin      — a company owner
export const ROLE_KEYS = ["superadmin", "admin", "hr", "accountant", "employee"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

// System roles (company_id NULL) are shared by every company; Page Master sets their pages.
// Custom roles belong to one company: key = the system role they're based on (rank + company-wide powers).
export const CUSTOM_ROLE_BASES = ["hr", "accountant", "employee"] as const;
export const roles = pgTable(
  "roles",
  {
    id: id(),
    key: varchar("key", { length: 20 }).notNull().$type<RoleKey>(),
    company_id: integer("company_id"), // NULL = system role
    description: varchar("description", { length: 200 }),
    name: varchar("name", { length: 100 }).notNull(),
    level: smallint("level").notNull(),
    // Inactive = can't be given to anyone new; people who have it keep it
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [
    fk("roles", t.company_id, companies.id, "cascade"),
    uniqueIndex("idx_roles_key").on(t.key).where(sql`${t.company_id} IS NULL`),
    uniqueIndex("idx_roles_company_name").on(t.company_id, sql`lower(${t.name})`).where(sql`${t.company_id} IS NOT NULL`),
  ],
);
