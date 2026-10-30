import { index, integer, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";
import { users } from "./user.schema.js";

// Who did what, when, and in which company — major events only (invites,
// verification, suspension, modules, access changes, logins created/blocked…).
// Rows are never edited; the actor's email is copied so it survives deletion.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actor_id: integer("actor_id"),
    actor_email: varchar("actor_email", { length: 150 }),
    company_id: integer("company_id"),
    action: varchar("action", { length: 60 }).notNull(), // e.g. company.suspended
    target_type: varchar("target_type", { length: 40 }),
    target_id: integer("target_id"),
    summary: text("summary").notNull(), // one readable line
    meta: jsonb("meta"),
    created_at: createdAt(),
  },
  (t) => [
    fk("audit_logs", t.actor_id, users.id, "set null"),
    fk("audit_logs", t.company_id, companies.id, "set null"),
    index("idx_audit_logs_created").on(t.created_at),
    index("idx_audit_logs_company").on(t.company_id),
  ],
);
