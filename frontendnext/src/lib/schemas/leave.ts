import { z } from "zod";
import { isoDate, optionalId, requiredNumber } from "./common";

export const leaveSchema = z
  .object({
    employeeId: optionalId,
    fromDate: isoDate("Choose a start date"),
    toDate: isoDate("Choose an end date"),
    leaveType: z.enum(["leave", "cl", "sl", "ol", "el", "comp_off"]),
    reason: z.string().trim(),
  })
  .refine((v) => v.toDate >= v.fromDate, { path: ["toDate"], message: "End date can't be before the start date" });

// Applying from the calendar: one day, reason required
export const dayLeaveSchema = z.object({
  leaveType: z.enum(["cl", "sl", "ol", "el", "comp_off"]),
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
export type LeavePayload = Omit<z.output<typeof leaveSchema>, "employeeId"> & { employeeId?: number | null };
export type LeavePolicyForm = z.input<typeof leavePolicySchema>;
export type LeavePolicyInput = z.output<typeof leavePolicySchema>;
