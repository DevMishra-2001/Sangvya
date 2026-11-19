import { z } from "zod";
import { idField, oneOf, optionalText, requiredText } from "../../utils/zod.js";

export const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
export const JOB_STATUSES = ["draft", "open", "on_hold", "closed"] as const;
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern"] as const;
export const SOURCES = ["referral", "linkedin", "naukri", "website", "walk_in", "agency", "other"] as const;

const optNum = (max: number) => z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(max).nullable().optional());
const optDate = z.preprocess((v) => v || null, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").nullable().optional());
const optId = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable().optional());

export const jobSchema = z
  .object({
    title: requiredText("Job title is required", 150),
    department: optionalText(),
    location: optionalText(),
    description: optionalText(),
    employmentType: z.enum(EMPLOYMENT_TYPES).nullable().optional(),
    experienceMin: optNum(50),
    experienceMax: optNum(50),
    salaryMin: optNum(100_000_000),
    salaryMax: optNum(100_000_000),
    openings: z.coerce.number().int().min(1, "At least 1 opening").max(500).default(1),
    skills: optionalText(),
    hiringManagerId: optId,
    closesOn: optDate,
    status: z.enum(JOB_STATUSES).default("open"),
  })
  .refine((v) => v.experienceMin == null || v.experienceMax == null || v.experienceMin <= v.experienceMax, { path: ["experienceMax"], message: "Max must be at least the min" })
  .refine((v) => v.salaryMin == null || v.salaryMax == null || v.salaryMin <= v.salaryMax, { path: ["salaryMax"], message: "Max must be at least the min" });

export const jobStatusSchema = z.object({
  status: oneOf(JOB_STATUSES, `Status must be one of: ${JOB_STATUSES.join(", ")}`),
});

const candidateFields = {
  name: requiredText("Candidate name is required", 150),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().email("Invalid email").nullable().optional()),
  phone: optionalText(),
  notes: optionalText(),
  source: z.enum(SOURCES).nullable().optional(),
  currentCompany: optionalText(),
  experienceYears: optNum(60),
  currentCtc: optNum(100_000_000),
  expectedCtc: optNum(100_000_000),
  noticeDays: optNum(365),
  location: optionalText(),
  rating: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(5).nullable().optional()),
};

export const candidateSchema = z.object({ jobPostingId: idField("Pick a job"), ...candidateFields });
export const candidateUpdateSchema = z.object({ jobPostingId: idField("Pick a job").optional(), ...candidateFields });

export const candidateStageSchema = z
  .object({
    stage: oneOf(STAGES, `Stage must be one of: ${STAGES.join(", ")}`),
    reason: optionalText(),
  })
  .refine((v) => v.stage !== "rejected" || v.reason, { path: ["reason"], message: "Say why they're rejected" });

export const candidateListQuery = z.object({
  jobId: z.coerce.number().int().positive().optional(),
  stage: z.enum(STAGES).optional(),
  search: z.string().trim().max(100).optional(),
});

export const noteSchema = z.object({ text: requiredText("Write the note", 2000) });

export const interviewSchema = z.object({
  roundName: requiredText("Name the round", 80),
  scheduledAt: z.string().datetime({ offset: true, message: "Pick a date and time" }),
  durationMin: z.coerce.number().int().min(10).max(480).default(45),
  mode: z.enum(["in_person", "video", "phone"]),
  location: optionalText(),
  interviewerId: idField("Pick the interviewer"),
});

export const interviewUpdateSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  durationMin: z.coerce.number().int().min(10).max(480).optional(),
  location: optionalText(),
  status: z.enum(["scheduled", "cancelled", "no_show"]).optional(),
});

export const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1, "Rate 1–5").max(5),
  recommendation: z.enum(["strong_yes", "yes", "no", "strong_no"]),
  feedback: requiredText("Write your feedback", 4000),
});

export const offerSchema = z.object({
  designation: requiredText("Designation is required", 150),
  department: optionalText(),
  ctcAnnual: z.coerce.number().positive("CTC must be more than 0").max(100_000_000),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the joining date"),
  expiresOn: optDate,
  workLocation: optionalText(),
  probationMonths: optNum(24),
  notes: optionalText(),
});

export const offerStatusSchema = z.object({ status: z.enum(["sent", "accepted", "declined", "withdrawn"]) });

export const hireSchema = z.object({ createSalary: z.boolean().default(true) });

export type JobInput = z.infer<typeof jobSchema>;
export type CandidateInput = z.infer<typeof candidateSchema>;
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;
export type InterviewInput = z.infer<typeof interviewSchema>;
export type InterviewUpdateInput = z.infer<typeof interviewUpdateSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type OfferInput = z.infer<typeof offerSchema>;
