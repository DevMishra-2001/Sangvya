import { z } from "zod";
import { idField, isoDate, oneOf, optionalNumber, optionalText, requiredText } from "../../utils/zod.js";

export const REVIEW_STATUSES = ["draft", "submitted", "acknowledged"] as const;

export const createCycleSchema = z.object({
  name: requiredText("Cycle name is required", 100),
  startDate: isoDate("Valid startDate is required"),
  endDate: isoDate("Valid endDate is required"),
});

export const cycleStatusSchema = z.object({
  status: oneOf(["active", "closed"], "Status must be 'active' or 'closed'"),
});

export const reviewSchema = z.object({
  cycleId: idField("Valid cycleId is required"),
  employeeId: idField("Valid employeeId is required"),
  rating: optionalNumber("Rating must be 1-5", { min: 1, max: 5, int: true }),
  strengths: optionalText(),
  improvements: optionalText(),
  goalsNextCycle: optionalText(),
  managerComments: optionalText(),
  status: oneOf(REVIEW_STATUSES, "Status must be draft, submitted, or acknowledged").default("draft"),
});

export const reviewStatusSchema = z.object({
  status: oneOf(REVIEW_STATUSES, "Status must be draft, submitted, or acknowledged"),
});

export const cycleIdParams = z.object({ cycleId: idField() });
export const employeeIdParams = z.object({ employeeId: idField() });

export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
