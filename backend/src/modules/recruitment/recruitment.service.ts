import { and, count, desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "../../config/db.js";
import { candidates, jobPostings } from "../../db/schema.js";
import { NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { findOrCreateDesignation } from "../designations/designations.service.js";
import { insertEmployee } from "../employees/employees.service.js";
import type { CandidateInput, CandidateUpdateInput, JobInput } from "./recruitment.schema.js";

// ---- Job postings ----

export async function listJobs(companyId: number) {
  const jobs = await db
    .select({ ...getTableColumns(jobPostings), candidate_count: count(candidates.id) })
    .from(jobPostings)
    .leftJoin(candidates, eq(candidates.job_posting_id, jobPostings.id))
    .where(eq(jobPostings.company_id, companyId))
    .groupBy(jobPostings.id)
    .orderBy(desc(jobPostings.created_at));
  return { jobs };
}

export async function createJob(companyId: number, input: JobInput) {
  const [job] = await db
    .insert(jobPostings)
    .values({
      company_id: companyId,
      title: input.title,
      department: input.department ?? null,
      location: input.location ?? null,
      description: input.description ?? null,
    })
    .returning();
  return { job };
}

export async function updateJobStatus(companyId: number, id: number, status: "open" | "closed") {
  const [job] = await db
    .update(jobPostings)
    .set({ status })
    .where(and(eq(jobPostings.company_id, companyId), eq(jobPostings.id, id)))
    .returning();
  if (!job) throw new NotFoundError("Job posting not found");
  return { job };
}

export async function deleteJob(companyId: number, id: number) {
  const [deleted] = await db
    .delete(jobPostings)
    .where(and(eq(jobPostings.company_id, companyId), eq(jobPostings.id, id)))
    .returning({ id: jobPostings.id });
  if (!deleted) throw new NotFoundError("Job posting not found");
}

// ---- Candidates ----

function selectCandidates() {
  return db
    .select({ ...getTableColumns(candidates), job_title: jobPostings.title })
    .from(candidates)
    .innerJoin(jobPostings, eq(jobPostings.id, candidates.job_posting_id));
}

export async function listCandidates(companyId: number) {
  return { candidates: await selectCandidates().where(eq(candidates.company_id, companyId)).orderBy(desc(candidates.created_at)) };
}

export async function createCandidate(companyId: number, input: CandidateInput) {
  // The job must be one of this company's postings
  const [job] = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(and(eq(jobPostings.company_id, companyId), eq(jobPostings.id, input.jobPostingId)));
  if (!job) throw new NotFoundError("Job posting not found");

  const [candidate] = await db
    .insert(candidates)
    .values({
      company_id: companyId,
      job_posting_id: input.jobPostingId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      resume_url: input.resumeUrl ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return { candidate };
}

async function updateCandidateRow(companyId: number, id: number, values: Partial<typeof candidates.$inferInsert>) {
  const [candidate] = await db
    .update(candidates)
    .set(values)
    .where(and(eq(candidates.company_id, companyId), eq(candidates.id, id)))
    .returning();
  if (!candidate) throw new NotFoundError("Candidate not found");
  return { candidate };
}

export function updateCandidateStage(companyId: number, id: number, stage: string) {
  return updateCandidateRow(companyId, id, { stage });
}

export function updateCandidate(companyId: number, id: number, input: CandidateUpdateInput) {
  return updateCandidateRow(companyId, id, {
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
  });
}

export async function deleteCandidate(companyId: number, id: number) {
  const [deleted] = await db
    .delete(candidates)
    .where(and(eq(candidates.company_id, companyId), eq(candidates.id, id)))
    .returning({ id: candidates.id });
  if (!deleted) throw new NotFoundError("Candidate not found");
}

// For a "hired" candidate — creates a matching Employee record so the person
// shows up in Employees/Attendance/Payroll too.
export async function convertToEmployee(companyId: number, id: number) {
  const [candidate] = await selectCandidates().where(and(eq(candidates.company_id, companyId), eq(candidates.id, id)));
  if (!candidate) throw new NotFoundError("Candidate not found");

  const employee = await insertEmployee(companyId, {
    name: candidate.name,
    // The job they were hired for becomes their designation
    designation_id: (await findOrCreateDesignation(companyId, candidate.job_title)).id,
    email: candidate.email,
    join_date: localDate(),
  });
  return { employee };
}
