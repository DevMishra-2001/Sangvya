import { index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

// Self-onboarding links: HR shares one, the employee fills in their own details. Only the token hash is stored.
export const onboardingLinks = pgTable(
  "onboarding_links",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    token_hash: text("token_hash").notNull().unique("onboarding_links_token_hash_key"),
    expires_at: timestamptz("expires_at").notNull(),
    submitted_at: timestamptz("submitted_at"),
    revoked_at: timestamptz("revoked_at"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("onboarding_links", t.company_id, companies.id, "cascade"),
    fk("onboarding_links", t.employee_id, employees.id, "cascade"),
    fk("onboarding_links", t.created_by, users.id, "set null"),
    index("idx_onboarding_links_employee").on(t.employee_id),
  ],
);
