import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";

// Job titles ("UX Designer", "Accounts Lead") — each company keeps its own list.
// Shown on profiles and payslips; they never affect access (that's the role).
export const designations = pgTable(
  "designations",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    // Inactive = not offered for new employees; people who have it keep it
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [
    fk("designations", t.company_id, companies.id, "cascade"),
    index("idx_designations_company").on(t.company_id),
    // One name per company, case-insensitive
    uniqueIndex("idx_designations_name").on(t.company_id, sql`lower(${t.name})`),
  ],
);
