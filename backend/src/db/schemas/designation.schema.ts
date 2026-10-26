import { boolean, pgTable, smallint, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, id } from "../columns.js";

// The fixed designations, highest first. `key` is what the code checks;
// `level` stops anyone from giving a designation above their own.
//   superadmin — the platform developer (set in the DB, never from the app)
//   admin      — a company owner
export const DESIGNATION_KEYS = ["superadmin", "admin", "hr", "accountant", "developer"] as const;
export type DesignationKey = (typeof DESIGNATION_KEYS)[number];

// One shared list for every company. Which pages each designation can open is
// set in the Page Master (app_page_access).
export const designations = pgTable(
  "designations",
  {
    id: id(),
    key: varchar("key", { length: 20 }).notNull().$type<DesignationKey>(),
    name: varchar("name", { length: 100 }).notNull(),
    level: smallint("level").notNull(),
    // Inactive = can't be given to anyone new; people who have it keep it
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("idx_designations_key").on(t.key),
  ],
);
