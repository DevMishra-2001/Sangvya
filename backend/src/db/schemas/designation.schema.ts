import { sql } from "drizzle-orm";
import { index, integer, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";

// Job titles a company uses (Software Engineer, HR Manager, …). Every company
// starts with a default list (modules/designations/designations.service.ts)
// and can add, rename or remove its own. Employees point at one.
export const designations = pgTable(
  "designations",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    created_at: createdAt(),
  },
  (t) => [
    fk("designations", t.company_id, companies.id, "cascade"),
    index("idx_designations_company").on(t.company_id),
    // One name per company, case-insensitive
    uniqueIndex("idx_designations_name").on(t.company_id, sql`lower(${t.name})`),
  ],
);
