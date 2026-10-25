import { sql } from "drizzle-orm";
import { date, index, pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { companies } from "./company.schema.js";

export const jobPostings = pgTable(
  "job_postings",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    department: varchar("department", { length: 100 }),
    location: varchar("location", { length: 100 }),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("open"), // open | closed
    created_at: createdAt(),
  },
  (t) => [
    fk("job_postings", t.company_id, companies.id, "cascade"),
    index("idx_job_postings_company").on(t.company_id, t.status),
  ],
);

export const candidates = pgTable(
  "candidates",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    job_posting_id: integer("job_posting_id").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    email: varchar("email", { length: 150 }),
    phone: varchar("phone", { length: 30 }),
    resume_url: text("resume_url"),
    // Pipeline stage: applied | screening | interview | offer | hired | rejected
    stage: varchar("stage", { length: 20 }).notNull().default("applied"),
    notes: text("notes"),
    applied_date: date("applied_date").notNull().default(sql`CURRENT_DATE`),
    created_at: createdAt(),
  },
  (t) => [
    fk("candidates", t.company_id, companies.id, "cascade"),
    fk("candidates", t.job_posting_id, jobPostings.id, "cascade"),
    index("idx_candidates_company_job").on(t.company_id, t.job_posting_id),
    index("idx_candidates_stage").on(t.company_id, t.stage),
  ],
);
