import { z } from "zod";
import { idField } from "../../utils/zod.js";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const optDate = z.preprocess((v) => v || null, iso.nullable().optional());
const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().max(max).nullable().optional());
const rating = z.coerce.number().int().min(1).max(5);

export const cycleSchema = z
  .object({
    name: z.string().trim().min(2, "Name the cycle").max(100),
    description: text(1000),
    startDate: iso,
    endDate: iso,
    selfReview: z.boolean().default(true),
    selfDue: optDate,
    managerDue: optDate,
    goalsWeight: z.coerce.number().int().min(0).max(100).default(70),
    competencies: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
  })
  .refine((v) => v.startDate <= v.endDate, { path: ["endDate"], message: "End must be after start" });

export const cycleStatusSchema = z.object({ status: z.enum(["active", "closed"]) });
export const launchSchema = z.object({
  departmentIds: z.array(z.coerce.number().int().positive()).max(200).optional(),
  employeeIds: z.array(z.coerce.number().int().positive()).max(5000).optional(),
});

export const goalSchema = z.object({
  title: z.string().trim().min(3, "Describe the goal").max(200),
  description: text(2000),
  target: text(200),
  weight: z.coerce.number().int().min(0).max(100).default(20),
});

export const checkinSchema = z.object({
  progress: z.coerce.number().int().min(0).max(100),
  status: z.enum(["on_track", "at_risk", "off_track", "done"]),
  note: text(1000),
});

const goalRatings = z.array(z.object({ goalId: z.coerce.number().int().positive(), rating })).max(50).default([]);
const competencies = z.record(z.string().max(60), rating).default({});

export const selfReviewSchema = z.object({ goalRatings, competencies, rating: rating.nullable().optional(), comments: text(4000), submit: z.boolean().default(false) });
export const managerReviewSchema = z.object({
  goalRatings,
  competencies,
  rating: rating.nullable().optional(),
  strengths: text(4000),
  improvements: text(4000),
  goalsNextCycle: text(4000),
  comments: text(4000),
  submit: z.boolean().default(false),
});
export const finalizeSchema = z.object({ finalRating: rating, hrComments: text(4000) });
export const acknowledgeSchema = z.object({ comment: text(2000) });
export const reviewerSchema = z.object({ managerId: z.coerce.number().int().positive().nullable() });

export const employeeIdParams = z.object({ employeeId: idField() });

export type CycleInput = z.infer<typeof cycleSchema>;
export type LaunchInput = z.infer<typeof launchSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
export type SelfReviewInput = z.infer<typeof selfReviewSchema>;
export type ManagerReviewInput = z.infer<typeof managerReviewSchema>;
export type FinalizeInput = z.infer<typeof finalizeSchema>;
