import { and, asc, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { designations, employees, performanceReviews, reviewCycles } from "../../db/schema.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { getEmployeeById } from "../employees/employees.service.js";
import type { CreateCycleInput, ReviewInput } from "./performance.schema.js";

// ---- Review cycles ----

export async function listCycles(companyId: number) {
  const cycles = await db
    .select({ ...getTableColumns(reviewCycles), review_count: count(performanceReviews.id) })
    .from(reviewCycles)
    .leftJoin(performanceReviews, eq(performanceReviews.cycle_id, reviewCycles.id))
    .where(eq(reviewCycles.company_id, companyId))
    .groupBy(reviewCycles.id)
    .orderBy(desc(reviewCycles.start_date));
  return { cycles };
}

export async function createCycle(companyId: number, { name, startDate, endDate }: CreateCycleInput) {
  const [cycle] = await db
    .insert(reviewCycles)
    .values({ company_id: companyId, name, start_date: startDate, end_date: endDate })
    .returning();
  return { cycle };
}

export async function updateCycleStatus(companyId: number, id: number, status: "active" | "closed") {
  const [cycle] = await db
    .update(reviewCycles)
    .set({ status })
    .where(and(eq(reviewCycles.company_id, companyId), eq(reviewCycles.id, id)))
    .returning();
  if (!cycle) throw new NotFoundError("Review cycle not found");
  return { cycle };
}

// ---- Reviews ----

export async function listReviewsByCycle(companyId: number, cycleId: number) {
  const reviews = await db
    .select({ ...getTableColumns(performanceReviews), employee_name: employees.name, designation: designations.name })
    .from(performanceReviews)
    .innerJoin(employees, eq(employees.id, performanceReviews.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.cycle_id, cycleId)))
    .orderBy(asc(employees.name));
  return { reviews };
}

export async function listReviewsByEmployee(companyId: number, employeeId: number) {
  const reviews = await db
    .select({ ...getTableColumns(performanceReviews), cycle_name: reviewCycles.name })
    .from(performanceReviews)
    .innerJoin(reviewCycles, eq(reviewCycles.id, performanceReviews.cycle_id))
    .where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.employee_id, employeeId)))
    .orderBy(desc(reviewCycles.start_date));
  return { reviews };
}

// Create or update (draft/submit) in one call: a second save for the same
// employee + cycle updates the existing review (UNIQUE (cycle_id, employee_id)).
export async function upsertReview(companyId: number, input: ReviewInput) {
  // Both must belong to this company
  const [cycle] = await db
    .select({ id: reviewCycles.id })
    .from(reviewCycles)
    .where(and(eq(reviewCycles.company_id, companyId), eq(reviewCycles.id, input.cycleId)));
  if (!cycle) throw new NotFoundError("Review cycle not found");
  await getEmployeeById(companyId, input.employeeId);

  const values = {
    rating: input.rating ?? null,
    strengths: input.strengths ?? null,
    improvements: input.improvements ?? null,
    goals_next_cycle: input.goalsNextCycle ?? null,
    manager_comments: input.managerComments ?? null,
    status: input.status,
  };
  const [review] = await db
    .insert(performanceReviews)
    .values({ company_id: companyId, cycle_id: input.cycleId, employee_id: input.employeeId, ...values })
    .onConflictDoUpdate({
      target: [performanceReviews.cycle_id, performanceReviews.employee_id],
      set: { ...values, updated_at: sql`now()` },
    })
    .returning();
  return { review };
}

// e.g. the employee acknowledges a submitted review
export async function updateReviewStatus(companyId: number, id: number, status: string) {
  const [review] = await db
    .update(performanceReviews)
    .set({ status, updated_at: sql`now()` })
    .where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.id, id)))
    .returning();
  if (!review) throw new NotFoundError("Review not found");
  return { review };
}
