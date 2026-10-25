import { z } from "zod";
import { isoDate, requiredText } from "./common";

export const cycleSchema = z
  .object({
    name: requiredText("Cycle name is required", 100),
    startDate: isoDate("Choose a start date"),
    endDate: isoDate("Choose an end date"),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "End date can't be before the start date" });

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Give a rating from 1 to 5").max(5),
  strengths: z.string().trim(),
  improvements: z.string().trim(),
  goalsNextCycle: z.string().trim(),
  managerComments: z.string().trim(),
});

export type CycleInput = z.infer<typeof cycleSchema>;
export type ReviewForm = z.infer<typeof reviewSchema>;
export type ReviewPayload = ReviewForm & { cycleId: number; employeeId: number; status: "draft" | "submitted" };
