import { z } from "zod";
import { isoDate, optionalId, requiredNumber } from "./common";

export const leaveSchema = z
  .object({
    employeeId: optionalId,
    fromDate: isoDate("Choose a start date"),
    toDate: z.string(), // checked below (not needed for a half day)
    leaveType: z.enum(["leave", "cl", "sl", "ol", "el", "comp_off"]),
    // "" = full day(s); first / second = half of one day (counts 0.5)
    halfDay: z.enum(["", "first", "second"]),
    reason: z.string().trim(),
  })
  .refine((v) => v.halfDay || /^\d{4}-\d{2}-\d{2}$/.test(v.toDate), { path: ["toDate"], message: "Choose an end date" })
  .refine((v) => v.halfDay || v.toDate >= v.fromDate, { path: ["toDate"], message: "End date can't be before the start date" })
  // A half day is a single day: the end date is the start date
  .transform(({ halfDay, ...v }) => ({ ...v, toDate: halfDay ? v.fromDate : v.toDate, halfDay: halfDay || undefined }));

// Applying from the calendar: one day, reason required
export const dayLeaveSchema = z.object({
  leaveType: z.enum(["cl", "sl", "ol", "el", "comp_off"]),
  halfDay: z.enum(["", "first", "second"]).transform((v) => v || undefined),
  reason: z.string().trim().min(1, "Add a short description"),
});

const quota = (label: string, max: number) => requiredNumber(`${label} must be a number from 0 to ${max}`, { min: 0, max });

export const leavePolicySchema = z.object({
  clPerYear: quota("CL per year", 365),
  slPerYear: quota("SL per year", 365),
  olPerYear: quota("OL per year", 365),
  elPerMonth: quota("EL per month", 31),
});

export type LeaveForm = z.input<typeof leaveSchema>;
export type LeavePayload = Omit<z.output<typeof leaveSchema>, "employeeId" | "halfDay"> & { employeeId?: number | null; halfDay?: "first" | "second" };
export type LeavePolicyForm = z.input<typeof leavePolicySchema>;
export type LeavePolicyInput = z.output<typeof leavePolicySchema>;

export const HALF_DAY_OPTIONS = [
  { value: "", label: "Full day" },
  { value: "first", label: "First half" },
  { value: "second", label: "Second half" },
];
