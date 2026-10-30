import { z } from "zod";
import { isoDate, requiredText } from "../../utils/zod.js";

// Add / edit a holiday
export const createHolidaySchema = z.object({
  date: isoDate("Valid date is required"),
  name: requiredText("Holiday name is required", 150),
  // Optional holiday: people take it with their OL quota
  isOptional: z.boolean({ invalid_type_error: "isOptional must be true or false" }).default(false),
});

export const holidayListQuery = z.object({
  year: z.preprocess((v) => (v ? Number(v) : undefined), z.number().int().min(2000).max(2100).optional()),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
