import { boolean, pgTable, smallint, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, id } from "../columns.js";

// System roles — what a person can DO in the app (their job title is a separate,
// company-defined designation). Highest first; `level` stops anyone from giving
// a role above their own.
//   superadmin — the platform developer (set in the DB, never from the app)
//   admin      — a company owner
export const ROLE_KEYS = ["superadmin", "admin", "hr", "accountant", "employee"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

// One shared list for every company. Which pages each role can open is set in
// the Page Master (app_page_roles).
export const roles = pgTable(
  "roles",
  {
    id: id(),
    key: varchar("key", { length: 20 }).notNull().$type<RoleKey>(),
    name: varchar("name", { length: 100 }).notNull(),
    level: smallint("level").notNull(),
    // Inactive = can't be given to anyone new; people who have it keep it
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex("idx_roles_key").on(t.key)],
);
