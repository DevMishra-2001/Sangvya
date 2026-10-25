import { index, pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";
import { users } from "./user.schema.js";

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("announcements", t.company_id, companies.id, "cascade"),
    fk("announcements", t.created_by, users.id, "set null"),
    index("idx_announcements_company").on(t.company_id, t.created_at.desc().nullsFirst()),
  ],
);
