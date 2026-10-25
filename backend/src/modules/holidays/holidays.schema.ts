import { z } from "zod";
import { isoDate, requiredText } from "../../utils/zod.js";

export const createHolidaySchema = z.object({
  date: isoDate("Valid date is required"),
  name: requiredText("Holiday name is required", 150),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
