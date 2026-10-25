import { z } from "zod";
import { optionalText, requiredId, requiredText } from "./common";

export const jobSchema = z.object({
  title: requiredText("Job title is required", 150),
  department: optionalText(100),
  location: optionalText(100),
  description: optionalText(),
});

export const candidateSchema = z.object({
  jobPostingId: requiredId("Choose a job posting"),
  name: requiredText("Candidate name is required", 150),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email")
    .transform((v) => v || null),
  phone: optionalText(30),
  resumeUrl: optionalText(),
  notes: optionalText(),
});

export type JobForm = z.input<typeof jobSchema>;
export type JobInput = z.output<typeof jobSchema>;
export type CandidateForm = z.input<typeof candidateSchema>;
export type CandidatePayload = z.output<typeof candidateSchema>;
