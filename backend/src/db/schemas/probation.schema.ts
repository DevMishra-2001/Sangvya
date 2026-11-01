import { date, index, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

export const PROBATION_STATUSES = ["on_probation", "extended", "confirmed", "not_confirmed"] as const;
export const PROBATION_ACTIONS = ["started", "extended", "confirmed", "not_confirmed", "note"] as const;

// Everything that happened in someone's probation (status itself lives on employees)
export const probationEvents = pgTable(
  "probation_events",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    action: varchar("action", { length: 15 }).notNull().$type<(typeof PROBATION_ACTIONS)[number]>(),
    old_end: date("old_end"),
    new_end: date("new_end"),
    notes: text("notes"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("probation_events", t.company_id, companies.id, "cascade"),
    fk("probation_events", t.employee_id, employees.id, "cascade"),
    fk("probation_events", t.created_by, users.id, "set null"),
    index("idx_probation_events_employee").on(t.employee_id),
  ],
);
