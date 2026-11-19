import { sql } from "drizzle-orm";
import { boolean, check, date, index, jsonb, numeric, pgTable, smallint, text, unique, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { users } from "./user.schema.js";
import { employees } from "./employee.schema.js";

// A review cycle groups reviews together, e.g. "Q3 2026" or "Annual 2026".
export const reviewCycles = pgTable(
  "review_cycles",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    start_date: date("start_date").notNull(),
    end_date: date("end_date").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"), // draft | active | closed
    description: text("description"),
    self_review: boolean("self_review").notNull().default(true),
    self_due: date("self_due"),
    manager_due: date("manager_due"),
    goals_weight: smallint("goals_weight").notNull().default(70), // % of the score from goals; the rest from competencies
    competencies: jsonb("competencies").$type<string[]>().notNull().default(sql`'["Quality of work","Ownership","Communication","Teamwork","Learning"]'::jsonb`),
    launched_at: timestamptz("launched_at"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("review_cycles", t.company_id, companies.id, "cascade"),
    fk("review_cycles", t.created_by, users.id, "set null"),
    index("idx_review_cycles_company").on(t.company_id, t.status),
  ],
);

// One review per employee per cycle.
export const performanceReviews = pgTable(
  "performance_reviews",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    cycle_id: integer("cycle_id").notNull(),
    employee_id: integer("employee_id").notNull(),
    rating: smallint("rating"),
    strengths: text("strengths"),
    improvements: text("improvements"),
    goals_next_cycle: text("goals_next_cycle"),
    manager_comments: text("manager_comments"),
    // pending_self → pending_manager → pending_hr → finalized → acknowledged
    status: varchar("status", { length: 20 }).notNull().default("pending_self"),
    manager_id: integer("manager_id"), // who reviews (the reporting manager at launch)
    self_rating: smallint("self_rating"),
    self_comments: text("self_comments"),
    self_submitted_at: timestamptz("self_submitted_at"),
    manager_submitted_at: timestamptz("manager_submitted_at"),
    // { "Ownership": { self: 4, manager: 3 }, … }
    competency_ratings: jsonb("competency_ratings").$type<Record<string, { self?: number; manager?: number }>>().notNull().default(sql`'{}'::jsonb`),
    score: numeric("score", { precision: 3, scale: 2 }), // weighted 1–5 from goals + competencies
    final_rating: smallint("final_rating"), // after HR calibration
    hr_comments: text("hr_comments"),
    finalized_at: timestamptz("finalized_at"),
    acknowledged_at: timestamptz("acknowledged_at"),
    employee_comment: text("employee_comment"),
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    fk("performance_reviews", t.company_id, companies.id, "cascade"),
    fk("performance_reviews", t.cycle_id, reviewCycles.id, "cascade"),
    fk("performance_reviews", t.employee_id, employees.id, "cascade"),
    fk("performance_reviews", t.manager_id, employees.id, "set null"),
    index("idx_perf_reviews_manager").on(t.manager_id),
    unique("performance_reviews_cycle_id_employee_id_key").on(t.cycle_id, t.employee_id),
    index("idx_perf_reviews_company_cycle").on(t.company_id, t.cycle_id),
    index("idx_perf_reviews_employee").on(t.employee_id),
    check("performance_reviews_rating_check", sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  ],
);

// Goals / KRAs of one review, with a weight; rated by the employee and the manager
export const performanceGoals = pgTable(
  "performance_goals",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    review_id: integer("review_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    target: varchar("target", { length: 200 }), // "₹50L sales", "Ship v2 by March"
    weight: smallint("weight").notNull().default(20),
    progress: smallint("progress").notNull().default(0), // 0–100
    status: varchar("status", { length: 12 }).notNull().default("on_track").$type<"on_track" | "at_risk" | "off_track" | "done">(),
    self_rating: smallint("self_rating"),
    manager_rating: smallint("manager_rating"),
    created_by: integer("created_by"),
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    fk("performance_goals", t.company_id, companies.id, "cascade"),
    fk("performance_goals", t.review_id, performanceReviews.id, "cascade"),
    fk("performance_goals", t.created_by, users.id, "set null"),
    index("idx_perf_goals_review").on(t.review_id),
  ],
);

// Progress updates on a goal during the cycle
export const goalCheckins = pgTable(
  "goal_checkins",
  {
    id: id(),
    company_id: integer("company_id").notNull(),
    goal_id: integer("goal_id").notNull(),
    progress: smallint("progress").notNull(),
    status: varchar("status", { length: 12 }).notNull(),
    note: text("note"),
    created_by: integer("created_by"),
    created_at: createdAt(),
  },
  (t) => [
    fk("goal_checkins", t.company_id, companies.id, "cascade"),
    fk("goal_checkins", t.goal_id, performanceGoals.id, "cascade"),
    fk("goal_checkins", t.created_by, users.id, "set null"),
    index("idx_goal_checkins_goal").on(t.goal_id),
  ],
);
