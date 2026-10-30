import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { users } from "./user.schema.js";

// In-app notifications (the bell).
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    // The company it's about (NULL = platform, e.g. for the Super Admin)
    company_id: integer("company_id"),
    // Who sees it
    user_id: integer("user_id").notNull(),
    // What happened, e.g. "leave.requested", "task.assigned" (for icons / filters)
    type: varchar("type", { length: 60 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    // App path opened on click, e.g. "/leave"
    link: varchar("link", { length: 500 }),
    // The record it's about, e.g. ("leave", 42)
    entity_type: varchar("entity_type", { length: 40 }),
    entity_id: integer("entity_id"),
    // Who caused it (NULL = the system)
    actor_id: integer("actor_id"),
    data: jsonb("data"),
    read_at: timestamptz("read_at"),
    created_at: createdAt(),
  },
  (t) => [
    fk("notifications", t.user_id, users.id, "cascade"),
    fk("notifications", t.company_id, companies.id, "cascade"),
    fk("notifications", t.actor_id, users.id, "set null"),
    // The bell: my latest, and my unread count
    index("idx_notifications_user_created").on(t.user_id, t.created_at),
    index("idx_notifications_user_unread").on(t.user_id).where(sql`${t.read_at} IS NULL`),
  ],
);
