import { z } from "zod";
import { idField, oneOf, optionalText, requiredText } from "../../utils/zod.js";

export const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

export const jobSchema = z.object({
  title: requiredText("Job title is required", 150),
  department: optionalText(),
  location: optionalText(),
  description: optionalText(),
});

export const jobStatusSchema = z.object({
  status: oneOf(["open", "closed"], "Status must be 'open' or 'closed'"),
});

export const candidateSchema = z.object({
  jobPostingId: idField("Valid jobPostingId is required"),
  name: requiredText("Candidate name is required", 150),
  email: optionalText(),
  phone: optionalText(),
  resumeUrl: optionalText(),
  notes: optionalText(),
});

export const candidateUpdateSchema = z.object({
  name: requiredText("Candidate name is required", 150),
  email: optionalText(),
  phone: optionalText(),
  notes: optionalText(),
});

export const candidateStageSchema = z.object({
  stage: oneOf(STAGES, `Stage must be one of: ${STAGES.join(", ")}`),
});

export type JobInput = z.infer<typeof jobSchema>;
export type CandidateInput = z.infer<typeof candidateSchema>;
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;
