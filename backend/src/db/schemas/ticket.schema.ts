import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, smallint, text, unique, varchar } from "drizzle-orm/pg-core";
import { auditColumns, auditFks } from "../auditColumns.js";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";
import { users } from "./user.schema.js";
import type { Attachment } from "./expense.schema.js";

// What a status means for the app (counts, delayed, kanban): the name and colour are the company's own
export const TICKET_STATUS_KINDS = ["open", "active", "hold", "review", "done", "closed"] as const;
export type TicketStatusKind = (typeof TICKET_STATUS_KINDS)[number];
export const FINISHED_KINDS: TicketStatusKind[] = ["done", "closed"];

// ---- Settings (per company) ----

export const ticketProjects = pgTable(
  "ticket_projects",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    code: varchar("code", { length: 20 }),
    client_name: varchar("client_name", { length: 150 }),
    version: varchar("version", { length: 50 }),
    description: text("description"),
    default_assignee_id: integer("default_assignee_id"),
    is_active: boolean("is_active").notNull().default(true),
    sort_order: smallint("sort_order").notNull().default(0),
    ...auditColumns(),
  },
  (t) => [
    fk("ticket_projects", t.company_id, companies.id, "cascade"),
    fk("ticket_projects", t.default_assignee_id, employees.id, "set null"),
    ...auditFks("ticket_projects", t),
    unique("ticket_projects_company_name_key").on(t.company_id, t.name),
  ],
);

export const ticketModules = pgTable(
  "ticket_modules",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    project_id: integer("project_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    is_active: boolean("is_active").notNull().default(true),
    ...auditColumns(),
  },
  (t) => [
    fk("ticket_modules", t.company_id, companies.id, "cascade"),
    fk("ticket_modules", t.project_id, ticketProjects.id, "cascade"),
    ...auditFks("ticket_modules", t),
    unique("ticket_modules_project_name_key").on(t.project_id, t.name),
  ],
);

export const ticketCategories = pgTable(
  "ticket_categories",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 9 }).notNull().default("#64748b"),
    default_days: smallint("default_days"), // delivery date = created + this many days, when not given
    is_active: boolean("is_active").notNull().default(true),
    sort_order: smallint("sort_order").notNull().default(0),
    ...auditColumns(),
  },
  (t) => [fk("ticket_categories", t.company_id, companies.id, "cascade"), ...auditFks("ticket_categories", t), unique("ticket_categories_company_name_key").on(t.company_id, t.name)],
);

export const ticketStatuses = pgTable(
  "ticket_statuses",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 9 }).notNull().default("#64748b"),
    kind: varchar("kind", { length: 10 }).notNull().default("open"),
    is_default: boolean("is_default").notNull().default(false), // new tickets start here
    is_active: boolean("is_active").notNull().default(true),
    sort_order: smallint("sort_order").notNull().default(0),
    ...auditColumns(),
  },
  (t) => [fk("ticket_statuses", t.company_id, companies.id, "cascade"), ...auditFks("ticket_statuses", t), unique("ticket_statuses_company_name_key").on(t.company_id, t.name)],
);

export const ticketPriorities = pgTable(
  "ticket_priorities",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 9 }).notNull().default("#64748b"),
    sla_hours: integer("sla_hours"), // delivery date when neither the ticket nor its category gives one
    is_default: boolean("is_default").notNull().default(false),
    is_active: boolean("is_active").notNull().default(true),
    sort_order: smallint("sort_order").notNull().default(0),
    ...auditColumns(),
  },
  (t) => [fk("ticket_priorities", t.company_id, companies.id, "cascade"), ...auditFks("ticket_priorities", t), unique("ticket_priorities_company_name_key").on(t.company_id, t.name)],
);

export const ticketSettings = pgTable(
  "ticket_settings",
  {
    company_id: integer("company_id").primaryKey(),
    prefix: varchar("prefix", { length: 10 }).notNull().default("TKT-"),
    number_digits: smallint("number_digits").notNull().default(4),
    next_number: integer("next_number").notNull().default(1),
    who_can_create: varchar("who_can_create", { length: 10 }).notNull().default("everyone"), // everyone | managers
    assign_anyone: boolean("assign_anyone").notNull().default(true), // false = only self / own team
    allow_self_assign: boolean("allow_self_assign").notNull().default(true),
    require_project: boolean("require_project").notNull().default(false),
    require_time_on_done: boolean("require_time_on_done").notNull().default(false),
    auto_close_days: smallint("auto_close_days"), // done → closed after this many days
    notify_on_assign: boolean("notify_on_assign").notNull().default(true),
    ...auditColumns(),
  },
  (t) => [fk("ticket_settings", t.company_id, companies.id, "cascade"), ...auditFks("ticket_settings", t)],
);

// ---- Tickets ----

export const tickets = pgTable(
  "tickets",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    number: integer("number").notNull(),
    code: varchar("code", { length: 30 }).notNull(), // e.g. TKT-0042
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    project_id: integer("project_id"),
    module_id: integer("module_id"),
    category_id: integer("category_id"),
    priority_id: integer("priority_id"),
    status_id: integer("status_id").notNull(),
    assigned_to: integer("assigned_to"),
    secondary_assignee: integer("secondary_assignee"),
    reported_by_name: varchar("reported_by_name", { length: 120 }),
    reported_by_mobile: varchar("reported_by_mobile", { length: 20 }),
    page_url: varchar("page_url", { length: 500 }),
    due_date: date("due_date"),
    estimate_minutes: integer("estimate_minutes"),
    spent_minutes: integer("spent_minutes").notNull().default(0),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default(sql`'[]'::jsonb`),
    started_at: timestamptz("started_at"),
    resolved_at: timestamptz("resolved_at"),
    closed_at: timestamptz("closed_at"),
    ...auditColumns(),
  },
  (t) => [
    fk("tickets", t.company_id, companies.id, "cascade"),
    fk("tickets", t.project_id, ticketProjects.id, "set null"),
    fk("tickets", t.module_id, ticketModules.id, "set null"),
    fk("tickets", t.category_id, ticketCategories.id, "set null"),
    fk("tickets", t.priority_id, ticketPriorities.id, "set null"),
    fk("tickets", t.status_id, ticketStatuses.id, "cascade"),
    fk("tickets", t.assigned_to, employees.id, "set null"),
    fk("tickets", t.secondary_assignee, employees.id, "set null"),
    ...auditFks("tickets", t),
    unique("tickets_company_number_key").on(t.company_id, t.number),
    index("idx_tickets_company_status").on(t.company_id, t.status_id),
    index("idx_tickets_assignee").on(t.company_id, t.assigned_to),
    index("idx_tickets_due").on(t.company_id, t.due_date),
    index("idx_tickets_created").on(t.company_id, t.created_at),
  ],
);

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    ticket_id: integer("ticket_id").notNull(),
    body: text("body").notNull(),
    ...auditColumns(),
  },
  (t) => [fk("ticket_comments", t.company_id, companies.id, "cascade"), fk("ticket_comments", t.ticket_id, tickets.id, "cascade"), ...auditFks("ticket_comments", t), index("idx_ticket_comments_ticket").on(t.ticket_id)],
);

// Activity: who did what to a ticket (created, status, assigned, field changes, time)
export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    ticket_id: integer("ticket_id").notNull(),
    kind: varchar("kind", { length: 12 }).notNull(),
    text: text("text").notNull(),
    meta: jsonb("meta"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("ticket_events", t.company_id, companies.id, "cascade"),
    fk("ticket_events", t.ticket_id, tickets.id, "cascade"),
    fk("ticket_events", t.created_by, users.id, "set null"),
    index("idx_ticket_events_ticket").on(t.ticket_id),
  ],
);

export const ticketTimeLogs = pgTable(
  "ticket_time_logs",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    ticket_id: integer("ticket_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    work_date: date("work_date").notNull(),
    minutes: integer("minutes").notNull(),
    note: text("note"),
    ...auditColumns(),
  },
  (t) => [
    fk("ticket_time_logs", t.company_id, companies.id, "cascade"),
    fk("ticket_time_logs", t.ticket_id, tickets.id, "cascade"),
    fk("ticket_time_logs", t.employee_id, employees.id, "cascade"),
    ...auditFks("ticket_time_logs", t),
    index("idx_ticket_time_employee_date").on(t.company_id, t.employee_id, t.work_date),
    index("idx_ticket_time_ticket").on(t.ticket_id),
  ],
);
