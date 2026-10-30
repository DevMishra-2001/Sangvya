import { z } from "zod";
import { isoDate, requiredText } from "./common";

export const holidaySchema = z
  .object({
    date: isoDate("Choose a date"),
    name: requiredText("Holiday name is required", 150),
    kind: z.enum(["holiday", "optional"]), // optional = taken with OL, not everyone's day off
  })
  .transform(({ kind, ...v }) => ({ ...v, isOptional: kind === "optional" }));

export type HolidayForm = z.input<typeof holidaySchema>;
export type HolidayInput = z.output<typeof holidaySchema>;
