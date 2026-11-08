import { sql } from "drizzle-orm";
import { check, date, index, numeric, pgTable, smallint, text, unique, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { users } from "./user.schema.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";

export const jobPostings = pgTable(
  "job_postings",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    department: varchar("department", { length: 100 }),
    location: varchar("location", { length: 100 }),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("open"), // draft | open | on_hold | closed
    employment_type: varchar("employment_type", { length: 20 }), // full_time | part_time | contract | intern
    experience_min: smallint("experience_min"), // years
    experience_max: smallint("experience_max"),
    salary_min: numeric("salary_min", { precision: 12, scale: 2 }), // per year
    salary_max: numeric("salary_max", { precision: 12, scale: 2 }),
    openings: smallint("openings").notNull().default(1),
    skills: text("skills"), // comma separated
    hiring_manager_id: integer("hiring_manager_id"),
    closes_on: date("closes_on"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("job_postings", t.company_id, companies.id, "cascade"),
    fk("job_postings", t.hiring_manager_id, employees.id, "set null"),
    fk("job_postings", t.created_by, users.id, "set null"),
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
    source: varchar("source", { length: 20 }), // referral | linkedin | naukri | website | walk_in | agency | other
    current_company: varchar("current_company", { length: 150 }),
    experience_years: numeric("experience_years", { precision: 4, scale: 1 }),
    current_ctc: numeric("current_ctc", { precision: 12, scale: 2 }),
    expected_ctc: numeric("expected_ctc", { precision: 12, scale: 2 }),
    notice_days: smallint("notice_days"),
    location: varchar("location", { length: 100 }),
    rating: smallint("rating"), // recruiter's overall 1–5
    rejection_reason: text("rejection_reason"),
    stage_changed_at: timestamptz("stage_changed_at").defaultNow(),
    resume_path: text("resume_path"), // private file (signed links)
    resume_name: varchar("resume_name", { length: 255 }),
    hired_employee_id: integer("hired_employee_id"),
    created_at: createdAt(),
  },
  (t) => [
    fk("candidates", t.company_id, companies.id, "cascade"),
    fk("candidates", t.job_posting_id, jobPostings.id, "cascade"),
    fk("candidates", t.hired_employee_id, employees.id, "set null"),
    index("idx_candidates_company_job").on(t.company_id, t.job_posting_id),
    index("idx_candidates_stage").on(t.company_id, t.stage),
  ],
);

// Timeline of a candidate: notes, stage moves, interviews, offer changes
export const candidateEvents = pgTable(
  "candidate_events",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    candidate_id: integer("candidate_id").notNull(),
    kind: varchar("kind", { length: 12 }).notNull().$type<"note" | "stage" | "interview" | "offer">(),
    text: text("text").notNull(),
    from_stage: varchar("from_stage", { length: 20 }),
    to_stage: varchar("to_stage", { length: 20 }),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("candidate_events", t.company_id, companies.id, "cascade"),
    fk("candidate_events", t.candidate_id, candidates.id, "cascade"),
    fk("candidate_events", t.created_by, users.id, "set null"),
    index("idx_candidate_events_candidate").on(t.candidate_id),
  ],
);

export const interviews = pgTable(
  "interviews",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    candidate_id: integer("candidate_id").notNull(),
    round_name: varchar("round_name", { length: 80 }).notNull(), // "Technical round 1"
    scheduled_at: timestamptz("scheduled_at").notNull(),
    duration_min: smallint("duration_min").notNull().default(45),
    mode: varchar("mode", { length: 12 }).notNull().$type<"in_person" | "video" | "phone">(),
    location: text("location"), // room or meeting link
    interviewer_id: integer("interviewer_id").notNull(), // employee
    status: varchar("status", { length: 12 }).notNull().default("scheduled").$type<"scheduled" | "completed" | "cancelled" | "no_show">(),
    rating: smallint("rating"),
    recommendation: varchar("recommendation", { length: 12 }).$type<"strong_yes" | "yes" | "no" | "strong_no">(),
    feedback: text("feedback"),
    feedback_at: timestamptz("feedback_at"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("interviews", t.company_id, companies.id, "cascade"),
    fk("interviews", t.candidate_id, candidates.id, "cascade"),
    fk("interviews", t.interviewer_id, employees.id, "cascade"),
    fk("interviews", t.created_by, users.id, "set null"),
    index("idx_interviews_company_time").on(t.company_id, t.scheduled_at),
    index("idx_interviews_interviewer").on(t.interviewer_id, t.status),
    check("interviews_rating_check", sql`${t.rating} IS NULL OR (${t.rating} >= 1 AND ${t.rating} <= 5)`),
  ],
);

// One offer per candidate (edited until accepted / declined)
export const offers = pgTable(
  "offers",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    candidate_id: integer("candidate_id").notNull(),
    designation: varchar("designation", { length: 150 }).notNull(),
    department: varchar("department", { length: 100 }),
    ctc_annual: numeric("ctc_annual", { precision: 12, scale: 2 }).notNull(),
    joining_date: date("joining_date").notNull(),
    expires_on: date("expires_on"),
    work_location: varchar("work_location", { length: 150 }),
    probation_months: smallint("probation_months"),
    notes: text("notes"), // extra terms printed on the letter
    status: varchar("status", { length: 12 }).notNull().default("draft").$type<"draft" | "sent" | "accepted" | "declined" | "withdrawn">(),
    sent_at: timestamptz("sent_at"),
    responded_at: timestamptz("responded_at"),
    created_by: integer("created_by"),
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    fk("offers", t.company_id, companies.id, "cascade"),
    fk("offers", t.candidate_id, candidates.id, "cascade"),
    fk("offers", t.created_by, users.id, "set null"),
    unique("offers_candidate_key").on(t.candidate_id),
  ],
);
