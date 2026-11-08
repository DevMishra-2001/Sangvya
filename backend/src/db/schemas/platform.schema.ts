import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, smallint, text, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { users } from "./user.schema.js";

// Super Admin settings for the whole platform (one row, id = 1). Values the code used to hard-code.
export const platformSettings = pgTable(
  "platform_settings",
  {
    id: smallint("id").primaryKey().default(1),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    updated_at: timestamptz("updated_at").defaultNow(),
    updated_by: integer("updated_by"),
  },
  (t) => [fk("platform_settings", t.updated_by, users.id, "set null"), check("platform_settings_single_row", sql`${t.id} = 1`)],
);

// One row per background job run (day close, probation reminders …) for the System health page
export const jobRuns = pgTable(
  "job_runs",
  {
    id: id(),
    job: varchar("job", { length: 40 }).notNull(),
    started_at: timestamptz("started_at").notNull().defaultNow(),
    finished_at: timestamptz("finished_at"),
    ok: boolean("ok"),
    detail: text("detail"),
  },
  (t) => [index("idx_job_runs_job").on(t.job, t.id.desc())],
);

// Every email the app tried to send (no body kept) — delivery health
export const mailLog = pgTable(
  "mail_log",
  {
    id: id(),
    company_id: integer("company_id"),
    to_email: varchar("to_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 300 }).notNull(),
    status: varchar("status", { length: 10 }).notNull().$type<"sent" | "failed" | "logged">(),
    error: text("error"),
    created_at: createdAt(),
  },
  (t) => [fk("mail_log", t.company_id, companies.id, "set null"), index("idx_mail_log_created").on(t.created_at.desc())],
);
