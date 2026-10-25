import { sql } from "drizzle-orm";
import { check, date, index, pgTable, smallint, text, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";

// Assigned by a manager/HR/superadmin to an employee. Flow:
// todo -> in_progress -> done (by the assignee) -> approved (by the assigner/HR),
// or reopened back to in_progress.
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    priority: varchar("priority", { length: 10 }).notNull().default("medium"), // low | medium | high
    status: varchar("status", { length: 20 }).notNull().default("todo"), // todo | in_progress | done | approved
    progress: smallint("progress").notNull().default(0),
    assigned_to: integer("assigned_to").notNull(),
    assigned_by: integer("assigned_by"),
    assigned_date: date("assigned_date").notNull().default(sql`CURRENT_DATE`),
    due_date: date("due_date"),
    completed_at: timestamptz("completed_at"),
    approved_by: integer("approved_by"),
    approved_at: timestamptz("approved_at"),
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    fk("tasks", t.company_id, companies.id, "cascade"),
    fk("tasks", t.assigned_to, employees.id, "cascade"),
    fk("tasks", t.assigned_by, users.id, "set null"),
    fk("tasks", t.approved_by, users.id, "set null"),
    index("idx_tasks_assignee").on(t.company_id, t.assigned_to),
    index("idx_tasks_assigner").on(t.company_id, t.assigned_by),
    check("tasks_progress_check", sql`${t.progress} >= 0 AND ${t.progress} <= 100`),
  ],
);
