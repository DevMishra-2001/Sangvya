import { sql } from "drizzle-orm";
import { check, date, index, pgTable, smallint, text, unique, varchar, integer } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
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
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | closed
    created_at: createdAt(),
  },
  (t) => [
    fk("review_cycles", t.company_id, companies.id, "cascade"),
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
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | submitted | acknowledged
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    fk("performance_reviews", t.company_id, companies.id, "cascade"),
    fk("performance_reviews", t.cycle_id, reviewCycles.id, "cascade"),
    fk("performance_reviews", t.employee_id, employees.id, "cascade"),
    unique("performance_reviews_cycle_id_employee_id_key").on(t.cycle_id, t.employee_id),
    index("idx_perf_reviews_company_cycle").on(t.company_id, t.cycle_id),
    index("idx_perf_reviews_employee").on(t.employee_id),
    check("performance_reviews_rating_check", sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  ],
);
