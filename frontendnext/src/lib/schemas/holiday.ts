import { z } from "zod";
import { isoDate, requiredText } from "./common";

export const holidaySchema = z.object({
  date: isoDate("Choose a date"),
  name: requiredText("Holiday name is required", 150),
});

export type HolidayInput = z.infer<typeof holidaySchema>;
