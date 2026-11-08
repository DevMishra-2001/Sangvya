// Performance: HR runs a review cycle → goals with check-ins → self review → manager review → HR finalizes → employee acknowledges
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { departments, designations, employees, goalCheckins, performanceGoals, performanceReviews, reviewCycles, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { can } from "../../utils/can.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { getEmployeeById } from "../employees/employees.service.js";
import { hrRecipients, notify } from "../notifications/notify.js";
import type { CheckinInput, CycleInput, FinalizeInput, GoalInput, LaunchInput, ManagerReviewInput, SelfReviewInput } from "./performance.schema.js";

export const RATING_LABELS = ["", "Needs improvement", "Below expectations", "Meets expectations", "Exceeds expectations", "Outstanding"];
type Review = typeof performanceReviews.$inferSelect;
type Cycle = typeof reviewCycles.$inferSelect;

// ---- Cycles (HR) ----

export async function listCycles(companyId: number) {
  const cycles = await db
    .select({
      id: reviewCycles.id,
      name: reviewCycles.name,
      description: reviewCycles.description,
      start_date: reviewCycles.start_date,
      end_date: reviewCycles.end_date,
      status: reviewCycles.status,
      self_review: reviewCycles.self_review,
      self_due: reviewCycles.self_due,
      manager_due: reviewCycles.manager_due,
      goals_weight: reviewCycles.goals_weight,
      competencies: reviewCycles.competencies,
      launched_at: reviewCycles.launched_at,
      review_count: sql<number>`(select count(*)::int from performance_reviews r where r.cycle_id = "review_cycles"."id")`,
      by_status: sql<Record<string, number>>`coalesce((select json_object_agg(status, n) from (select r.status, count(*)::int n from performance_reviews r where r.cycle_id = "review_cycles"."id" group by r.status) x), '{}'::json)`,
    })
    .from(reviewCycles)
    .where(eq(reviewCycles.company_id, companyId))
    .orderBy(desc(reviewCycles.start_date));
  return { cycles };
}

const cycleColumns = (i: CycleInput) => ({
  name: i.name,
  description: i.description ?? null,
  start_date: i.startDate,
  end_date: i.endDate,
  self_review: i.selfReview,
  self_due: i.selfDue ?? null,
  manager_due: i.managerDue ?? null,
  goals_weight: i.goalsWeight,
  competencies: i.competencies,
});

export async function createCycle(companyId: number, actor: Express.AuthUser, input: CycleInput) {
  const [cycle] = await db.insert(reviewCycles).values({ company_id: companyId, created_by: actor.id, status: "draft", ...cycleColumns(input) }).returning();
  audit(actor, { companyId, action: "performance.cycle", target: ["cycle", cycle.id], summary: `Created the review cycle "${cycle.name}"` });
  return { cycle };
}

async function findCycle(companyId: number, id: number) {
  const [c] = await db.select().from(reviewCycles).where(and(eq(reviewCycles.company_id, companyId), eq(reviewCycles.id, id)));
  if (!c) throw new NotFoundError("Review cycle not found");
  return c;
}

export async function updateCycle(companyId: number, actor: Express.AuthUser, id: number, input: CycleInput) {
  const c = await findCycle(companyId, id);
  if (c.status === "closed") throw new BadRequestError("This cycle is closed");
  const [cycle] = await db.update(reviewCycles).set(cycleColumns(input)).where(eq(reviewCycles.id, id)).returning();
  audit(actor, { companyId, action: "performance.cycle", target: ["cycle", id], summary: `Updated the review cycle "${cycle.name}"` });
  return { cycle };
}

export async function setCycleStatus(companyId: number, actor: Express.AuthUser, id: number, status: "active" | "closed") {
  const c = await findCycle(companyId, id);
  if (status === "active" && !c.launched_at) throw new BadRequestError("Launch the cycle to add people first");
  await db.update(reviewCycles).set({ status }).where(eq(reviewCycles.id, id));
  audit(actor, { companyId, action: "performance.cycle", target: ["cycle", id], summary: `${status === "closed" ? "Closed" : "Reopened"} the review cycle "${c.name}"` });
  return listCycles(companyId);
}

// Adds everyone in scope (active staff, optionally some departments) — safe to run again for new joiners
export async function launchCycle(companyId: number, actor: Express.AuthUser, id: number, input: LaunchInput) {
  const c = await findCycle(companyId, id);
  if (c.status === "closed") throw new BadRequestError("This cycle is closed");
  const people = await db
    .select({ id: employees.id, manager_id: employees.manager_id })
    .from(employees)
    .where(
      and(
        eq(employees.company_id, companyId),
        eq(employees.status, "active"),
        input.departmentIds?.length ? inArray(employees.department_id, input.departmentIds) : undefined,
        input.employeeIds?.length ? inArray(employees.id, input.employeeIds) : undefined,
      ),
    );
  if (!people.length) throw new BadRequestError("Nobody matches");
  const first = c.self_review ? "pending_self" : "pending_manager";
  const added = await db
    .insert(performanceReviews)
    .values(people.map((p) => ({ company_id: companyId, cycle_id: id, employee_id: p.id, manager_id: p.manager_id, status: first })))
    .onConflictDoNothing()
    .returning({ employee_id: performanceReviews.employee_id });
  await db.update(reviewCycles).set({ status: "active", launched_at: c.launched_at ?? new Date() }).where(eq(reviewCycles.id, id));
  audit(actor, { companyId, action: "performance.cycle", target: ["cycle", id], summary: `Launched "${c.name}" for ${added.length} people` });
  if (added.length) {
    void notify({
      companyId,
      to: added.map((a) => ({ employeeId: a.employee_id })),
      type: "performance.launched",
      title: `Performance review: ${c.name}`,
      body: c.self_review ? `Set your goals and fill your self review${c.self_due ? ` by ${c.self_due}` : ""}.` : "Your manager will review your performance this cycle.",
      link: "/my-performance",
      actorId: actor.id,
    });
  }
  return { added: added.length, ...(await listCycles(companyId)) };
}

// ---- Reviews ----

const manager = sql<string | null>`(select m.name from employees m where m.id = ${performanceReviews.manager_id})`;
const goalCount = sql<number>`(select count(*)::int from performance_goals g where g.review_id = ${performanceReviews.id})`;

const reviewRow = {
  id: performanceReviews.id,
  cycle_id: performanceReviews.cycle_id,
  cycle_name: reviewCycles.name,
  cycle_status: reviewCycles.status,
  employee_id: performanceReviews.employee_id,
  employee_name: employees.name,
  photo_url: employees.photo_url,
  designation: designations.name,
  department: departments.name,
  manager_id: performanceReviews.manager_id,
  manager_name: manager,
  status: performanceReviews.status,
  self_rating: performanceReviews.self_rating,
  rating: performanceReviews.rating,
  score: performanceReviews.score,
  final_rating: performanceReviews.final_rating,
  goal_count: goalCount,
  self_due: reviewCycles.self_due,
  manager_due: reviewCycles.manager_due,
  updated_at: performanceReviews.updated_at,
};

const reviewQuery = () =>
  db
    .select(reviewRow)
    .from(performanceReviews)
    .innerJoin(reviewCycles, eq(reviewCycles.id, performanceReviews.cycle_id))
    .innerJoin(employees, eq(employees.id, performanceReviews.employee_id))
    .leftJoin(designations, eq(designations.id, employees.designation_id))
    .leftJoin(departments, eq(departments.id, employees.department_id));

export async function cycleReviews(companyId: number, cycleId: number) {
  await findCycle(companyId, cycleId);
  return { reviews: await reviewQuery().where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.cycle_id, cycleId))).orderBy(asc(employees.name)) };
}

// Everything on one review, plus what the viewer may do
async function access(companyId: number, actor: Express.AuthUser, id: number) {
  const [r] = await db.select().from(performanceReviews).where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.id, id)));
  if (!r) throw new NotFoundError("Review not found");
  const cycle = await findCycle(companyId, r.cycle_id);
  const isSelf = actor.employeeId === r.employee_id;
  const isManager = (actor.employeeId != null && actor.employeeId === r.manager_id) || (!isSelf && can(actor, "performance.review"));
  const isHr = can(actor, "performance.manageCycles");
  if (!isSelf && !isManager && !isHr) throw new ForbiddenError("You can't see this review");
  return { r, cycle, isSelf, isManager, isHr };
}

export async function reviewDetail(companyId: number, actor: Express.AuthUser, id: number) {
  const { r, cycle, isSelf, isManager, isHr } = await access(companyId, actor, id);
  const [[row], goals] = await Promise.all([
    reviewQuery().where(eq(performanceReviews.id, id)),
    db.select().from(performanceGoals).where(eq(performanceGoals.review_id, id)).orderBy(asc(performanceGoals.id)),
  ]);
  const checkins = goals.length
    ? await db
        .select({ id: goalCheckins.id, goal_id: goalCheckins.goal_id, progress: goalCheckins.progress, status: goalCheckins.status, note: goalCheckins.note, created_at: goalCheckins.created_at, by: users.name })
        .from(goalCheckins)
        .leftJoin(users, eq(users.id, goalCheckins.created_by))
        .where(inArray(goalCheckins.goal_id, goals.map((g) => g.id)))
        .orderBy(desc(goalCheckins.id))
    : [];
  // The employee sees the manager's ratings only once HR has finalized
  const hideManager = isSelf && !isManager && !isHr && !["finalized", "acknowledged"].includes(r.status);
  const review = {
    ...row,
    self_comments: r.self_comments,
    strengths: hideManager ? null : r.strengths,
    improvements: hideManager ? null : r.improvements,
    goals_next_cycle: hideManager ? null : r.goals_next_cycle,
    manager_comments: hideManager ? null : r.manager_comments,
    rating: hideManager ? null : r.rating,
    score: hideManager ? null : row.score,
    hr_comments: hideManager ? null : r.hr_comments,
    competency_ratings: Object.fromEntries(Object.entries(r.competency_ratings).map(([k, v]) => [k, hideManager ? { self: v.self } : v])),
    self_submitted_at: r.self_submitted_at,
    manager_submitted_at: r.manager_submitted_at,
    finalized_at: r.finalized_at,
    acknowledged_at: r.acknowledged_at,
    employee_comment: r.employee_comment,
  };
  return {
    review,
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status, self_review: cycle.self_review, goals_weight: cycle.goals_weight, competencies: cycle.competencies, self_due: cycle.self_due, manager_due: cycle.manager_due, start_date: cycle.start_date, end_date: cycle.end_date },
    goals: goals.map((g) => ({ ...g, manager_rating: hideManager ? null : g.manager_rating, checkins: checkins.filter((c) => c.goal_id === g.id) })),
    you: { isSelf, isManager, isHr },
    ratingLabels: RATING_LABELS,
  };
}

// "My performance": my reviews + the ones I review as a manager
export async function myPerformance(companyId: number, employeeId: number) {
  const [mine, team] = await Promise.all([
    reviewQuery()
      .where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.employee_id, employeeId), ne(reviewCycles.status, "draft")))
      .orderBy(desc(reviewCycles.start_date)),
    reviewQuery()
      .where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.manager_id, employeeId), ne(reviewCycles.status, "draft")))
      .orderBy(asc(sql`case ${performanceReviews.status} when 'pending_manager' then 1 when 'pending_self' then 2 else 3 end`), asc(employees.name)),
  ]);
  return { mine, team };
}

// Old per-employee list (employee profile)
export async function employeeReviews(companyId: number, employeeId: number) {
  await getEmployeeById(companyId, employeeId);
  return { reviews: await reviewQuery().where(and(eq(performanceReviews.company_id, companyId), eq(performanceReviews.employee_id, employeeId))).orderBy(desc(reviewCycles.start_date)) };
}

// ---- Goals ----

function assertOpen(r: Review, cycle: Cycle) {
  if (cycle.status === "closed") throw new BadRequestError("This cycle is closed");
  if (["finalized", "acknowledged"].includes(r.status)) throw new BadRequestError("This review is finalized");
}

export async function addGoal(companyId: number, actor: Express.AuthUser, reviewId: number, input: GoalInput) {
  const { r, cycle, isSelf, isManager, isHr } = await access(companyId, actor, reviewId);
  assertOpen(r, cycle);
  if (isSelf && !isManager && !isHr && r.status !== "pending_self") throw new BadRequestError("Your self review is already submitted — ask your manager to add goals");
  await db.insert(performanceGoals).values({ company_id: companyId, review_id: reviewId, title: input.title, description: input.description ?? null, target: input.target ?? null, weight: input.weight, created_by: actor.id });
  return reviewDetail(companyId, actor, reviewId);
}

async function goalAccess(companyId: number, actor: Express.AuthUser, goalId: number) {
  const [g] = await db.select().from(performanceGoals).where(and(eq(performanceGoals.company_id, companyId), eq(performanceGoals.id, goalId)));
  if (!g) throw new NotFoundError("Goal not found");
  return { g, ...(await access(companyId, actor, g.review_id)) };
}

export async function updateGoal(companyId: number, actor: Express.AuthUser, goalId: number, input: GoalInput) {
  const { g, r, cycle } = await goalAccess(companyId, actor, goalId);
  assertOpen(r, cycle);
  await db.update(performanceGoals).set({ title: input.title, description: input.description ?? null, target: input.target ?? null, weight: input.weight, updated_at: new Date() }).where(eq(performanceGoals.id, goalId));
  return reviewDetail(companyId, actor, g.review_id);
}

export async function deleteGoal(companyId: number, actor: Express.AuthUser, goalId: number) {
  const { g, r, cycle } = await goalAccess(companyId, actor, goalId);
  assertOpen(r, cycle);
  await db.delete(performanceGoals).where(eq(performanceGoals.id, goalId));
  return reviewDetail(companyId, actor, g.review_id);
}

export async function checkinGoal(companyId: number, actor: Express.AuthUser, goalId: number, input: CheckinInput) {
  const { g, r, cycle } = await goalAccess(companyId, actor, goalId);
  assertOpen(r, cycle);
  await db.transaction(async (tx) => {
    await tx.insert(goalCheckins).values({ company_id: companyId, goal_id: goalId, progress: input.progress, status: input.status, note: input.note ?? null, created_by: actor.id });
    await tx.update(performanceGoals).set({ progress: input.progress, status: input.status, updated_at: new Date() }).where(eq(performanceGoals.id, goalId));
  });
  return reviewDetail(companyId, actor, g.review_id);
}

// ---- Steps ----

async function saveGoalRatings(reviewId: number, ratings: { goalId: number; rating: number }[], who: "self" | "manager") {
  for (const x of ratings) {
    await db
      .update(performanceGoals)
      .set(who === "self" ? { self_rating: x.rating } : { manager_rating: x.rating })
      .where(and(eq(performanceGoals.review_id, reviewId), eq(performanceGoals.id, x.goalId)));
  }
}

// Weighted goals + plain average of competencies, mixed by the cycle's goals weight
function score(goals: { weight: number; manager_rating: number | null }[], competencies: Record<string, { manager?: number }>, goalsWeight: number) {
  const rated = goals.filter((g) => g.manager_rating);
  const w = rated.reduce((t, g) => t + g.weight, 0);
  const goalScore = w ? rated.reduce((t, g) => t + g.weight * g.manager_rating!, 0) / w : null;
  const comps = Object.values(competencies).map((c) => c.manager).filter((n): n is number => Boolean(n));
  const compScore = comps.length ? comps.reduce((t, n) => t + n, 0) / comps.length : null;
  if (goalScore == null && compScore == null) return null;
  if (goalScore == null) return compScore;
  if (compScore == null) return goalScore;
  return (goalScore * goalsWeight + compScore * (100 - goalsWeight)) / 100;
}

export async function saveSelfReview(companyId: number, actor: Express.AuthUser, id: number, input: SelfReviewInput) {
  const { r, cycle, isSelf } = await access(companyId, actor, id);
  if (!isSelf) throw new ForbiddenError("Only the employee fills their self review");
  assertOpen(r, cycle);
  if (r.status !== "pending_self") throw new BadRequestError("Your self review is already submitted");
  await saveGoalRatings(id, input.goalRatings, "self");
  const comps = { ...r.competency_ratings };
  for (const [k, v] of Object.entries(input.competencies)) comps[k] = { ...comps[k], self: v };
  await db
    .update(performanceReviews)
    .set({
      self_rating: input.rating ?? null,
      self_comments: input.comments ?? null,
      competency_ratings: comps,
      updated_at: new Date(),
      ...(input.submit ? { status: "pending_manager", self_submitted_at: new Date() } : {}),
    })
    .where(eq(performanceReviews.id, id));
  if (input.submit && r.manager_id) {
    const e = await getEmployeeById(companyId, r.employee_id);
    void notify({ companyId, to: [{ employeeId: r.manager_id }], type: "performance.self_done", title: `${e.name} submitted their self review`, body: `${cycle.name} — your review is next.`, link: "/my-performance?tab=team", actorId: actor.id });
  }
  return reviewDetail(companyId, actor, id);
}

export async function saveManagerReview(companyId: number, actor: Express.AuthUser, id: number, input: ManagerReviewInput) {
  const { r, cycle, isManager, isHr } = await access(companyId, actor, id);
  if (!isManager && !isHr) throw new ForbiddenError("Only the reviewer can do this");
  assertOpen(r, cycle);
  if (r.status === "pending_hr" && !isHr) throw new BadRequestError("Already sent to HR");
  await saveGoalRatings(id, input.goalRatings, "manager");
  const comps = { ...r.competency_ratings };
  for (const [k, v] of Object.entries(input.competencies)) comps[k] = { ...comps[k], manager: v };
  const goals = await db.select({ weight: performanceGoals.weight, manager_rating: performanceGoals.manager_rating }).from(performanceGoals).where(eq(performanceGoals.review_id, id));
  const s = score(goals, comps, cycle.goals_weight);
  await db
    .update(performanceReviews)
    .set({
      rating: input.rating ?? (s ? Math.round(s) : null),
      strengths: input.strengths ?? null,
      improvements: input.improvements ?? null,
      goals_next_cycle: input.goalsNextCycle ?? null,
      manager_comments: input.comments ?? null,
      competency_ratings: comps,
      score: s == null ? null : s.toFixed(2),
      updated_at: new Date(),
      ...(input.submit ? { status: "pending_hr", manager_submitted_at: new Date() } : {}),
    })
    .where(eq(performanceReviews.id, id));
  if (input.submit) {
    const e = await getEmployeeById(companyId, r.employee_id);
    void notify({ companyId, to: await hrRecipients(companyId), type: "performance.manager_done", title: `Review ready for HR: ${e.name}`, body: cycle.name, link: `/performance?cycle=${cycle.id}`, actorId: actor.id });
  }
  return reviewDetail(companyId, actor, id);
}

export async function finalizeReview(companyId: number, actor: Express.AuthUser, id: number, input: FinalizeInput) {
  const { r, cycle, isHr } = await access(companyId, actor, id);
  if (!isHr) throw new ForbiddenError("Only HR finalizes reviews");
  if (r.status !== "pending_hr") throw new BadRequestError("The manager hasn't submitted this review yet");
  await db
    .update(performanceReviews)
    .set({ final_rating: input.finalRating, hr_comments: input.hrComments ?? null, status: "finalized", finalized_at: new Date(), updated_at: new Date() })
    .where(eq(performanceReviews.id, id));
  const e = await getEmployeeById(companyId, r.employee_id);
  audit(actor, { companyId, action: "performance.finalized", target: ["employee", r.employee_id], summary: `Finalized ${e.name}'s review (${cycle.name}): ${input.finalRating}/5` });
  void notify({ companyId, to: [{ employeeId: r.employee_id }], type: "performance.finalized", title: `Your ${cycle.name} review is ready`, body: "Read it and acknowledge.", link: "/my-performance", actorId: actor.id });
  return reviewDetail(companyId, actor, id);
}

// HR sends a finalized-too-early or wrong review back to the manager
export async function reopenReview(companyId: number, actor: Express.AuthUser, id: number) {
  const { r, cycle, isHr } = await access(companyId, actor, id);
  if (!isHr) throw new ForbiddenError("Only HR can reopen");
  if (cycle.status === "closed") throw new BadRequestError("This cycle is closed");
  if (r.status === "acknowledged") throw new BadRequestError("The employee already acknowledged it");
  await db.update(performanceReviews).set({ status: "pending_manager", finalized_at: null, final_rating: null, updated_at: new Date() }).where(eq(performanceReviews.id, id));
  return reviewDetail(companyId, actor, id);
}

export async function acknowledgeReview(companyId: number, actor: Express.AuthUser, id: number, comment: string | null | undefined) {
  const { r, isSelf } = await access(companyId, actor, id);
  if (!isSelf) throw new ForbiddenError("Only the employee acknowledges");
  if (r.status !== "finalized") throw new BadRequestError("The review isn't final yet");
  await db.update(performanceReviews).set({ status: "acknowledged", acknowledged_at: new Date(), employee_comment: comment ?? null, updated_at: new Date() }).where(eq(performanceReviews.id, id));
  return reviewDetail(companyId, actor, id);
}

// HR can change who reviews someone
export async function setReviewer(companyId: number, actor: Express.AuthUser, id: number, managerId: number | null) {
  const { r, isHr } = await access(companyId, actor, id);
  if (!isHr) throw new ForbiddenError("Only HR can change the reviewer");
  if (managerId) {
    if (managerId === r.employee_id) throw new BadRequestError("Someone can't review themselves");
    await getEmployeeById(companyId, managerId);
  }
  await db.update(performanceReviews).set({ manager_id: managerId }).where(eq(performanceReviews.id, id));
  return reviewDetail(companyId, actor, id);
}
