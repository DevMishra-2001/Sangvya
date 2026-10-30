import { boolean, integer, pgTable, unique, varchar } from "drizzle-orm/pg-core";
import { fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";

// Modules the Super Admin has switched on/off for a company (see config/modules.ts).
// No row = on: every module is available until switched off.
export const companyModules = pgTable(
  "company_modules",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    module_key: varchar("module_key", { length: 30 }).notNull(),
    is_enabled: boolean("is_enabled").notNull().default(true),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [fk("company_modules", t.company_id, companies.id, "cascade"), unique("company_modules_company_module_key").on(t.company_id, t.module_key)],
);
