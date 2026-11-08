// Recruitment: job openings → candidates on a stage board → interviews with feedback → offer → hire as an employee
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { candidateEvents, candidates, departments, designations, employees, interviews, jobPostings, offers, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { can } from "../../utils/can.js";
import { localDate } from "../../utils/workday.js";
import { insertEmployee } from "../employees/employees.service.js";
import { notify } from "../notifications/notify.js";
import { roleByKey } from "../pages/access.service.js";
import { getImageKit } from "../../config/imagekit.js";
import { storeFile, type UploadedFile } from "../upload/upload.service.js";
import type { CandidateInput, CandidateUpdateInput, FeedbackInput, InterviewInput, InterviewUpdateInput, JobInput, OfferInput } from "./recruitment.schema.js";
import type { STAGES } from "./recruitment.schema.js";

type Stage = (typeof STAGES)[number];
const STAGE_LABEL: Record<Stage, string> = { applied: "Applied", screening: "Screening", interview: "Interview", offer: "Offer", hired: "Hired", rejected: "Rejected" };
const STAGE_ORDER: Stage[] = ["applied", "screening", "interview", "offer", "hired"];
const num = (v: number | null | undefined) => (v == null ? null : String(v));

async function event(companyId: number, candidateId: number, actorId: number | null, kind: "note" | "stage" | "interview" | "offer", text: string, stages?: { from: string; to: string }) {
  await db.insert(candidateEvents).values({ company_id: companyId, candidate_id: candidateId, kind, text, from_stage: stages?.from ?? null, to_stage: stages?.to ?? null, created_by: actorId });
}

async function assertEmployee(companyId: number, id: number | null | undefined, what = "Employee") {
  if (!id) return null;
  const [e] = await db.select({ id: employees.id, name: employees.name, status: employees.status }).from(employees).where(and(eq(employees.company_id, companyId), eq(employees.id, id)));
  if (!e || e.status === "exited") throw new BadRequestError(`${what} not found`);
  return e;
}

// ---- Jobs ----

const stageCounts = sql<Record<string, number>>`coalesce((select json_object_agg(stage, n) from (select c.stage, count(*)::int n from candidates c where c.job_posting_id = ${jobPostings.id} group by c.stage) x), '{}'::json)`;

export async function listJobs(companyId: number) {
  const jobs = await db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
      department: jobPostings.department,
      location: jobPostings.location,
      description: jobPostings.description,
      status: jobPostings.status,
      employment_type: jobPostings.employment_type,
      experience_min: jobPostings.experience_min,
      experience_max: jobPostings.experience_max,
      salary_min: jobPostings.salary_min,
      salary_max: jobPostings.salary_max,
      openings: jobPostings.openings,
      skills: jobPostings.skills,
      hiring_manager_id: jobPostings.hiring_manager_id,
      hiring_manager_name: employees.name,
      closes_on: jobPostings.closes_on,
      created_at: jobPostings.created_at,
      candidate_count: sql<number>`(select count(*)::int from candidates c where c.job_posting_id = ${jobPostings.id})`,
      hired_count: sql<number>`(select count(*)::int from candidates c where c.job_posting_id = ${jobPostings.id} and c.stage = 'hired')`,
      stage_counts: stageCounts,
    })
    .from(jobPostings)
    .leftJoin(employees, eq(employees.id, jobPostings.hiring_manager_id))
    .where(eq(jobPostings.company_id, companyId))
    .orderBy(sql`case ${jobPostings.status} when 'open' then 1 when 'on_hold' then 2 when 'draft' then 3 else 4 end`, desc(jobPostings.created_at));
  return { jobs };
}

const jobColumns = (input: JobInput) => ({
  title: input.title,
  department: input.department ?? null,
  location: input.location ?? null,
  description: input.description ?? null,
  employment_type: input.employmentType ?? null,
  experience_min: input.experienceMin ?? null,
  experience_max: input.experienceMax ?? null,
  salary_min: num(input.salaryMin),
  salary_max: num(input.salaryMax),
  openings: input.openings,
  skills: input.skills ?? null,
  hiring_manager_id: input.hiringManagerId ?? null,
  closes_on: input.closesOn ?? null,
  status: input.status,
});

export async function createJob(companyId: number, actor: Express.AuthUser, input: JobInput) {
  await assertEmployee(companyId, input.hiringManagerId, "Hiring manager");
  const [job] = await db.insert(jobPostings).values({ company_id: companyId, created_by: actor.id, ...jobColumns(input) }).returning();
  audit(actor, { companyId, action: "recruitment.job", target: ["job", job.id], summary: `Opened the job "${job.title}" (${job.openings} position${job.openings === 1 ? "" : "s"})` });
  return { job };
}

export async function updateJob(companyId: number, actor: Express.AuthUser, id: number, input: JobInput) {
  await assertEmployee(companyId, input.hiringManagerId, "Hiring manager");
  const [job] = await db.update(jobPostings).set(jobColumns(input)).where(and(eq(jobPostings.company_id, companyId), eq(jobPostings.id, id))).returning();
  if (!job) throw new NotFoundError("Job not found");
  audit(actor, { companyId, action: "recruitment.job", target: ["job", id], summary: `Updated the job "${job.title}"` });
  return { job };
}

export async function updateJobStatus(companyId: number, actor: Express.AuthUser, id: number, status: string) {
  const [job] = await db
    .update(jobPostings)
    .set({ status })
    .where(and(eq(jobPostings.company_id, companyId), eq(jobPostings.id, id)))
    .returning();
  if (!job) throw new NotFoundError("Job not found");
  audit(actor, { companyId, action: "recruitment.job", target: ["job", id], summary: `Job "${job.title}" is now ${status.replace("_", " ")}` });
  return { job };
}

export async function deleteJob(companyId: number, actor: Express.AuthUser, id: number) {
  const [job] = await db.select({ title: jobPostings.title, n: sql<number>`(select count(*)::int from candidates c where c.job_posting_id = "job_postings"."id")` }).from(jobPostings).where(and(eq(jobPostings.company_id, companyId), eq(jobPostings.id, id)));
  if (!job) throw new NotFoundError("Job not found");
  if (job.n > 0) throw new BadRequestError(`${job.n} candidate${job.n === 1 ? " is" : "s are"} on this job — close it instead`);
  await db.delete(jobPostings).where(eq(jobPostings.id, id));
  audit(actor, { companyId, action: "recruitment.job", target: ["job", id], summary: `Deleted the job "${job.title}"` });
}

// ---- Candidates ----

const candidateRow = {
  id: candidates.id,
  job_posting_id: candidates.job_posting_id,
  job_title: jobPostings.title,
  name: candidates.name,
  email: candidates.email,
  phone: candidates.phone,
  stage: candidates.stage,
  notes: candidates.notes,
  applied_date: candidates.applied_date,
  source: candidates.source,
  current_company: candidates.current_company,
  experience_years: candidates.experience_years,
  current_ctc: candidates.current_ctc,
  expected_ctc: candidates.expected_ctc,
  notice_days: candidates.notice_days,
  location: candidates.location,
  rating: candidates.rating,
  rejection_reason: candidates.rejection_reason,
  stage_changed_at: candidates.stage_changed_at,
  resume_name: candidates.resume_name,
  hired_employee_id: candidates.hired_employee_id,
  created_at: candidates.created_at,
  next_interview: sql<string | null>`(select min(i.scheduled_at) from interviews i where i.candidate_id = ${candidates.id} and i.status = 'scheduled' and i.scheduled_at > now())`,
  interviews_done: sql<number>`(select count(*)::int from interviews i where i.candidate_id = ${candidates.id} and i.status = 'completed')`,
  avg_score: sql<string | null>`(select round(avg(i.rating), 1)::text from interviews i where i.candidate_id = ${candidates.id} and i.rating is not null)`,
  offer_status: sql<string | null>`(select o.status from offers o where o.candidate_id = ${candidates.id})`,
};

const selectCandidates = () => db.select(candidateRow).from(candidates).innerJoin(jobPostings, eq(jobPostings.id, candidates.job_posting_id));

export async function listCandidates(companyId: number, q: { jobId?: number; stage?: string; search?: string }) {
  const filters = [eq(candidates.company_id, companyId)];
  if (q.jobId) filters.push(eq(candidates.job_posting_id, q.jobId));
  if (q.stage) filters.push(eq(candidates.stage, q.stage));
  if (q.search) {
    const like = `%${q.search.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(or(ilike(candidates.name, like), ilike(candidates.email, like), ilike(candidates.phone, like), ilike(candidates.current_company, like))!);
  }
  return { candidates: await selectCandidates().where(and(...filters)).orderBy(desc(candidates.stage_changed_at)) };
}

async function findCandidate(companyId: number, id: number) {
  const [c] = await selectCandidates().where(and(eq(candidates.company_id, companyId), eq(candidates.id, id)));
  if (!c) throw new NotFoundError("Candidate not found");
  return c;
}

const interviewRow = {
  id: interviews.id,
  candidate_id: interviews.candidate_id,
  round_name: interviews.round_name,
  scheduled_at: interviews.scheduled_at,
  duration_min: interviews.duration_min,
  mode: interviews.mode,
  location: interviews.location,
  interviewer_id: interviews.interviewer_id,
  interviewer_name: employees.name,
  status: interviews.status,
  rating: interviews.rating,
  recommendation: interviews.recommendation,
  feedback: interviews.feedback,
  feedback_at: interviews.feedback_at,
};

// Everything on one candidate: details, timeline, interviews, offer
export async function candidateDetail(companyId: number, id: number) {
  const candidate = await findCandidate(companyId, id);
  const [events, rounds, [offer]] = await Promise.all([
    db
      .select({ id: candidateEvents.id, kind: candidateEvents.kind, text: candidateEvents.text, from_stage: candidateEvents.from_stage, to_stage: candidateEvents.to_stage, created_at: candidateEvents.created_at, by: users.name })
      .from(candidateEvents)
      .leftJoin(users, eq(users.id, candidateEvents.created_by))
      .where(eq(candidateEvents.candidate_id, id))
      .orderBy(desc(candidateEvents.id)),
    db.select(interviewRow).from(interviews).innerJoin(employees, eq(employees.id, interviews.interviewer_id)).where(eq(interviews.candidate_id, id)).orderBy(asc(interviews.scheduled_at)),
    db.select().from(offers).where(eq(offers.candidate_id, id)),
  ]);
  return { candidate, events, interviews: rounds, offer: offer ?? null };
}

const candidateColumns = (input: CandidateUpdateInput) => ({
  name: input.name,
  email: input.email ?? null,
  phone: input.phone ?? null,
  notes: input.notes ?? null,
  source: input.source ?? null,
  current_company: input.currentCompany ?? null,
  experience_years: num(input.experienceYears),
  current_ctc: num(input.currentCtc),
  expected_ctc: num(input.expectedCtc),
  notice_days: input.noticeDays ?? null,
  location: input.location ?? null,
  rating: input.rating ?? null,
});

async function assertJob(companyId: number, id: number) {
  const [job] = await db.select({ id: jobPostings.id, title: jobPostings.title, status: jobPostings.status }).from(jobPostings).where(and(eq(jobPostings.company_id, companyId), eq(jobPostings.id, id)));
  if (!job) throw new NotFoundError("Job not found");
  return job;
}

export async function createCandidate(companyId: number, actor: Express.AuthUser, input: CandidateInput) {
  const job = await assertJob(companyId, input.jobPostingId);
  if (input.email) {
    const [dup] = await db.select({ id: candidates.id }).from(candidates).where(and(eq(candidates.job_posting_id, job.id), sql`lower(${candidates.email}) = lower(${input.email})`));
    if (dup) throw new BadRequestError(`${input.email} has already applied for ${job.title}`);
  }
  const [c] = await db.insert(candidates).values({ company_id: companyId, job_posting_id: job.id, ...candidateColumns(input) }).returning({ id: candidates.id });
  await event(companyId, c.id, actor.id, "stage", `Added for ${job.title}${input.source ? ` (via ${input.source.replace("_", " ")})` : ""}`, { from: "", to: "applied" });
  return candidateDetail(companyId, c.id);
}

export async function updateCandidate(companyId: number, actor: Express.AuthUser, id: number, input: CandidateUpdateInput) {
  await findCandidate(companyId, id);
  if (input.jobPostingId) await assertJob(companyId, input.jobPostingId);
  await db
    .update(candidates)
    .set({ ...candidateColumns(input), ...(input.jobPostingId ? { job_posting_id: input.jobPostingId } : {}) })
    .where(eq(candidates.id, id));
  return candidateDetail(companyId, id);
}

export async function moveCandidate(companyId: number, actor: Express.AuthUser, id: number, stage: Stage, reason?: string | null) {
  const c = await findCandidate(companyId, id);
  if (c.stage === stage) return candidateDetail(companyId, id);
  if (c.stage === "hired") throw new BadRequestError(`${c.name} is already hired`);
  if (stage === "hired" && !c.hired_employee_id) throw new BadRequestError("Use “Hire” so the employee record is created");
  await db
    .update(candidates)
    .set({ stage, stage_changed_at: new Date(), rejection_reason: stage === "rejected" ? (reason ?? null) : null })
    .where(eq(candidates.id, id));
  await event(companyId, id, actor.id, "stage", `${STAGE_LABEL[c.stage as Stage] ?? c.stage} → ${STAGE_LABEL[stage]}${reason ? ` — ${reason}` : ""}`, { from: c.stage, to: stage });
  return candidateDetail(companyId, id);
}

export async function deleteCandidate(companyId: number, actor: Express.AuthUser, id: number) {
  const c = await findCandidate(companyId, id);
  if (c.stage === "hired") throw new BadRequestError("A hired candidate can't be deleted");
  await db.delete(candidates).where(eq(candidates.id, id));
  audit(actor, { companyId, action: "recruitment.candidate", target: ["candidate", id], summary: `Deleted the candidate ${c.name} (${c.job_title})` });
}

export async function addNote(companyId: number, actor: Express.AuthUser, id: number, text: string) {
  await findCandidate(companyId, id);
  await event(companyId, id, actor.id, "note", text);
  return candidateDetail(companyId, id);
}

export async function uploadResume(companyId: number, actor: Express.AuthUser, id: number, file: UploadedFile | undefined) {
  await findCandidate(companyId, id);
  const stored = await storeFile("candidate-resume", { companyId, employeeId: actor.employeeId }, file);
  await db.update(candidates).set({ resume_path: stored.filePath, resume_name: stored.fileName }).where(eq(candidates.id, id));
  await event(companyId, id, actor.id, "note", `Resume uploaded: ${stored.fileName}`);
  return candidateDetail(companyId, id);
}

// Short-lived signed link to the private resume file
export async function resumeLink(companyId: number, id: number) {
  const [c] = await db.select({ path: candidates.resume_path }).from(candidates).where(and(eq(candidates.company_id, companyId), eq(candidates.id, id)));
  if (!c?.path) throw new NotFoundError("No resume uploaded");
  return { url: getImageKit().url({ path: c.path, signed: true, expireSeconds: 300 }) };
}

// ---- Interviews ----

const fmtWhen = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export async function scheduleInterview(companyId: number, actor: Express.AuthUser, candidateId: number, input: InterviewInput) {
  const c = await findCandidate(companyId, candidateId);
  if (c.stage === "hired" || c.stage === "rejected") throw new BadRequestError(`${c.name} is ${c.stage}`);
  const interviewer = (await assertEmployee(companyId, input.interviewerId, "Interviewer"))!;
  const at = new Date(input.scheduledAt);
  const [row] = await db
    .insert(interviews)
    .values({
      company_id: companyId,
      candidate_id: candidateId,
      round_name: input.roundName,
      scheduled_at: at,
      duration_min: input.durationMin,
      mode: input.mode,
      location: input.location ?? null,
      interviewer_id: interviewer.id,
      created_by: actor.id,
    })
    .returning({ id: interviews.id });
  await event(companyId, candidateId, actor.id, "interview", `${input.roundName} scheduled with ${interviewer.name} on ${fmtWhen(at)}`);
  // Moving into the interview stage happens on its own
  if (STAGE_ORDER.indexOf(c.stage as Stage) < STAGE_ORDER.indexOf("interview")) {
    await db.update(candidates).set({ stage: "interview", stage_changed_at: new Date() }).where(eq(candidates.id, candidateId));
    await event(companyId, candidateId, actor.id, "stage", `${STAGE_LABEL[c.stage as Stage]} → Interview`, { from: c.stage, to: "interview" });
  }
  void notify({
    companyId,
    to: [{ employeeId: interviewer.id }],
    type: "interview.scheduled",
    title: `Interview: ${c.name} (${c.job_title})`,
    body: `${input.roundName} · ${fmtWhen(at)} · ${input.mode === "video" ? "Video call" : input.mode === "phone" ? "Phone" : "In person"}${input.location ? ` · ${input.location}` : ""}`,
    link: "/my-interviews",
    entity: ["interview", row.id],
    actorId: actor.id,
    email: (r) => ({ template: "notification", props: { name: r.name, title: `Interview scheduled: ${c.name}`, body: `${input.roundName} for ${c.job_title} on ${fmtWhen(at)}. Please add your feedback after the interview.`, link: "/my-interviews" } }),
  });
  return candidateDetail(companyId, candidateId);
}

async function findInterview(companyId: number, id: number) {
  const [i] = await db.select().from(interviews).where(and(eq(interviews.company_id, companyId), eq(interviews.id, id)));
  if (!i) throw new NotFoundError("Interview not found");
  return i;
}

export async function updateInterview(companyId: number, actor: Express.AuthUser, id: number, input: InterviewUpdateInput) {
  const i = await findInterview(companyId, id);
  if (i.status === "completed") throw new BadRequestError("Feedback is already in for this interview");
  const set: Partial<typeof interviews.$inferInsert> = {};
  if (input.scheduledAt) set.scheduled_at = new Date(input.scheduledAt);
  if (input.durationMin) set.duration_min = input.durationMin;
  if (input.location !== undefined) set.location = input.location ?? null;
  if (input.status) set.status = input.status;
  await db.update(interviews).set(set).where(eq(interviews.id, id));
  const what = input.status === "cancelled" ? "cancelled" : input.status === "no_show" ? "marked as no-show" : `moved to ${fmtWhen(set.scheduled_at ?? i.scheduled_at)}`;
  await event(companyId, i.candidate_id, actor.id, "interview", `${i.round_name} ${what}`);
  if (input.status === "cancelled" || input.scheduledAt) {
    void notify({ companyId, to: [{ employeeId: i.interviewer_id }], type: "interview.updated", title: `${i.round_name} ${what}`, link: "/recruitment", entity: ["interview", id], actorId: actor.id });
  }
  return candidateDetail(companyId, i.candidate_id);
}

// The interviewer (or a recruiter) records the result
export async function submitFeedback(companyId: number, actor: Express.AuthUser, id: number, input: FeedbackInput) {
  const i = await findInterview(companyId, id);
  if (i.interviewer_id !== actor.employeeId && !can(actor, "recruitment.candidates")) throw new ForbiddenError("Only the interviewer can add feedback");
  if (i.status === "cancelled") throw new BadRequestError("This interview was cancelled");
  await db.update(interviews).set({ status: "completed", rating: input.rating, recommendation: input.recommendation, feedback: input.feedback, feedback_at: new Date() }).where(eq(interviews.id, id));
  const rec = { strong_yes: "Strong yes", yes: "Yes", no: "No", strong_no: "Strong no" }[input.recommendation];
  await event(companyId, i.candidate_id, actor.id, "interview", `${i.round_name} feedback: ${input.rating}/5 · ${rec}`);
  return { ok: true };
}

// "My interviews" — for any employee who interviews (no recruitment access needed)
export async function myInterviews(companyId: number, employeeId: number) {
  const rows = await db
    .select({ ...interviewRow, candidate_name: candidates.name, job_title: jobPostings.title, candidate_email: candidates.email, candidate_phone: candidates.phone })
    .from(interviews)
    .innerJoin(employees, eq(employees.id, interviews.interviewer_id))
    .innerJoin(candidates, eq(candidates.id, interviews.candidate_id))
    .innerJoin(jobPostings, eq(jobPostings.id, candidates.job_posting_id))
    .where(and(eq(interviews.company_id, companyId), eq(interviews.interviewer_id, employeeId), inArray(interviews.status, ["scheduled", "completed"]), gte(interviews.scheduled_at, sql`now() - interval '30 days'`)))
    .orderBy(asc(interviews.scheduled_at));
  return { interviews: rows };
}

// ---- Offer ----

export async function saveOffer(companyId: number, actor: Express.AuthUser, candidateId: number, input: OfferInput) {
  const c = await findCandidate(companyId, candidateId);
  if (c.stage === "rejected" || c.stage === "hired") throw new BadRequestError(`${c.name} is ${c.stage}`);
  const [existing] = await db.select({ status: offers.status }).from(offers).where(eq(offers.candidate_id, candidateId));
  if (existing && (existing.status === "accepted" || existing.status === "declined")) throw new BadRequestError(`The offer was already ${existing.status}`);
  const values = {
    designation: input.designation,
    department: input.department ?? null,
    ctc_annual: String(input.ctcAnnual),
    joining_date: input.joiningDate,
    expires_on: input.expiresOn ?? null,
    work_location: input.workLocation ?? null,
    probation_months: input.probationMonths ?? null,
    notes: input.notes ?? null,
    updated_at: new Date(),
  };
  await db
    .insert(offers)
    .values({ company_id: companyId, candidate_id: candidateId, created_by: actor.id, ...values })
    .onConflictDoUpdate({ target: offers.candidate_id, set: values });
  await event(companyId, candidateId, actor.id, "offer", `${existing ? "Offer updated" : "Offer drafted"}: ${input.designation}, ₹${input.ctcAnnual.toLocaleString("en-IN")}/year, joining ${input.joiningDate}`);
  return candidateDetail(companyId, candidateId);
}

export async function setOfferStatus(companyId: number, actor: Express.AuthUser, candidateId: number, status: "sent" | "accepted" | "declined" | "withdrawn") {
  const c = await findCandidate(companyId, candidateId);
  const [offer] = await db.select().from(offers).where(eq(offers.candidate_id, candidateId));
  if (!offer) throw new BadRequestError("Make the offer first");
  await db
    .update(offers)
    .set({ status, ...(status === "sent" ? { sent_at: new Date() } : {}), ...(status === "accepted" || status === "declined" ? { responded_at: new Date() } : {}), updated_at: new Date() })
    .where(eq(offers.id, offer.id));
  await event(companyId, candidateId, actor.id, "offer", { sent: "Offer sent", accepted: "Offer accepted 🎉", declined: "Offer declined", withdrawn: "Offer withdrawn" }[status]);
  if (status === "sent" && STAGE_ORDER.indexOf(c.stage as Stage) < STAGE_ORDER.indexOf("offer")) {
    await db.update(candidates).set({ stage: "offer", stage_changed_at: new Date() }).where(eq(candidates.id, candidateId));
    await event(companyId, candidateId, actor.id, "stage", `${STAGE_LABEL[c.stage as Stage]} → Offer`, { from: c.stage, to: "offer" });
  }
  audit(actor, { companyId, action: "recruitment.offer", target: ["candidate", candidateId], summary: `Offer to ${c.name} (${c.job_title}): ${status}` });
  return candidateDetail(companyId, candidateId);
}

export async function offerForPdf(companyId: number, candidateId: number) {
  const c = await findCandidate(companyId, candidateId);
  const [offer] = await db.select().from(offers).where(eq(offers.candidate_id, candidateId));
  if (!offer) throw new NotFoundError("No offer for this candidate");
  return { candidate: c, offer };
}

// ---- Hire: candidate → employee ----

export async function hireCandidate(companyId: number, actor: Express.AuthUser, id: number) {
  const c = await findCandidate(companyId, id);
  if (c.hired_employee_id) throw new BadRequestError(`${c.name} is already an employee`);
  if (c.stage === "rejected") throw new BadRequestError(`${c.name} was rejected`);
  const [offer] = await db.select().from(offers).where(eq(offers.candidate_id, id));
  // Match the offer's designation / department to the company's lists when they exist
  const [desig] = offer ? await db.select({ id: designations.id }).from(designations).where(and(eq(designations.company_id, companyId), sql`lower(${designations.name}) = lower(${offer.designation})`)) : [];
  const deptName = offer?.department;
  const [dept] = deptName ? await db.select({ id: departments.id }).from(departments).where(and(eq(departments.company_id, companyId), sql`lower(${departments.name}) = lower(${deptName})`)) : [];
  const joinDate = offer?.joining_date ?? localDate();
  const probationEnd = offer?.probation_months ? new Date(new Date(`${joinDate}T00:00:00Z`).setUTCMonth(new Date(`${joinDate}T00:00:00Z`).getUTCMonth() + offer.probation_months)).toISOString().slice(0, 10) : null;

  const employee = await insertEmployee(companyId, {
    name: c.name,
    role_id: (await roleByKey("employee"))?.id ?? null,
    email: c.email,
    phone: c.phone,
    join_date: joinDate,
    designation_id: desig?.id ?? null,
    department_id: dept?.id ?? null,
    salary: offer ? String(Math.round(Number(offer.ctc_annual) / 12)) : null,
    probation_end_date: probationEnd,
    probation_status: probationEnd ? "on_probation" : null,
  });
  await db.update(candidates).set({ stage: "hired", stage_changed_at: new Date(), hired_employee_id: employee.id }).where(eq(candidates.id, id));
  await event(companyId, id, actor.id, "stage", `${STAGE_LABEL[c.stage as Stage]} → Hired · employee record created`, { from: c.stage, to: "hired" });
  audit(actor, { companyId, action: "recruitment.hired", target: ["employee", employee.id], summary: `Hired ${c.name} for ${c.job_title} (joining ${joinDate})` });
  return { employee, candidate: (await candidateDetail(companyId, id)).candidate };
}

// ---- Dashboard ----

export async function recruitmentOverview(companyId: number) {
  const today = localDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [[stats], funnel, sources, upcoming] = await Promise.all([
    db
      .select({
        openJobs: sql<number>`(select count(*)::int from job_postings j where j.company_id = ${companyId} and j.status = 'open')`,
        openPositions: sql<number>`(select coalesce(sum(j.openings), 0)::int from job_postings j where j.company_id = ${companyId} and j.status = 'open')`,
        active: sql<number>`(select count(*)::int from candidates c where c.company_id = ${companyId} and c.stage not in ('hired', 'rejected'))`,
        interviewsWeek: sql<number>`(select count(*)::int from interviews i where i.company_id = ${companyId} and i.status = 'scheduled' and i.scheduled_at between now() and now() + interval '7 days')`,
        pendingFeedback: sql<number>`(select count(*)::int from interviews i where i.company_id = ${companyId} and i.status = 'scheduled' and i.scheduled_at < now())`,
        offersOut: sql<number>`(select count(*)::int from offers o where o.company_id = ${companyId} and o.status = 'sent')`,
        hiredMonth: sql<number>`(select count(*)::int from candidates c where c.company_id = ${companyId} and c.stage = 'hired' and c.stage_changed_at >= ${monthStart}::date)`,
        avgDaysToHire: sql<number | null>`(select round(avg(extract(epoch from (c.stage_changed_at - c.applied_date::timestamp)) / 86400))::int from candidates c where c.company_id = ${companyId} and c.stage = 'hired')`,
      })
      .from(sql`(select 1) x`),
    db.select({ stage: candidates.stage, n: sql<number>`count(*)::int` }).from(candidates).where(eq(candidates.company_id, companyId)).groupBy(candidates.stage),
    db
      .select({ source: sql<string>`coalesce(${candidates.source}, 'other')`, n: sql<number>`count(*)::int`, hired: sql<number>`count(*) filter (where ${candidates.stage} = 'hired')::int` })
      .from(candidates)
      .where(eq(candidates.company_id, companyId))
      .groupBy(sql`1`),
    db
      .select({ ...interviewRow, candidate_id: interviews.candidate_id, candidate_name: candidates.name, job_title: jobPostings.title })
      .from(interviews)
      .innerJoin(employees, eq(employees.id, interviews.interviewer_id))
      .innerJoin(candidates, eq(candidates.id, interviews.candidate_id))
      .innerJoin(jobPostings, eq(jobPostings.id, candidates.job_posting_id))
      .where(and(eq(interviews.company_id, companyId), eq(interviews.status, "scheduled"), lt(interviews.scheduled_at, sql`now() + interval '14 days'`)))
      .orderBy(asc(interviews.scheduled_at))
      .limit(15),
  ]);
  return { stats, funnel, sources, upcoming };
}
