import { z } from "zod";
import { pageQuery } from "../../utils/pagination.js";

const isoDate = (label: string) => z.string({ required_error: `${label} is required` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date`);
const notes = (required = false) =>
  required
    ? z.string({ required_error: "Add a reason" }).trim().min(3, "Add a reason").max(1000, "Can be at most 1000 characters")
    : z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(1000, "Can be at most 1000 characters").optional());

export const listQuery = z.object({
  ...pageQuery,
  tab: z.enum(["active", "due", "overdue", "decided", "all"]).catch("active").default("active"),
  search: z.string().trim().max(100).optional().catch(undefined),
});

export const startSchema = z.object({ employeeId: z.coerce.number().int().positive("Pick an employee"), endDate: isoDate("Probation end"), notes: notes() });
export const confirmSchema = z.object({ confirmedOn: isoDate("Confirmation date"), notes: notes() });
export const extendSchema = z.object({ newEnd: isoDate("New end date"), notes: notes(true) });
// Not confirmed: optionally start their exit right away
export const notConfirmedSchema = z.object({ notes: notes(true), lastWorkingDay: z.preprocess((v) => v || undefined, isoDate("Last working day").optional()) });
export const noteSchema = z.object({ notes: notes(true) });
