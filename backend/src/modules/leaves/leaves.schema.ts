import { z } from "zod";
import { isoDate, numberField, oneOf, optionalId, optionalText } from "../../utils/zod.js";

// cl (casual) | sl (sick) | ol (optional) | el (earned) | comp_off (earned by working a Sunday/holiday)
// "leave" (general) is kept for older requests.
export const LEAVE_TYPES = ["leave", "cl", "sl", "ol", "el", "comp_off"] as const;

export const applyLeaveSchema = z.object({
  employeeId: optionalId("Invalid employeeId"), // HR applying on someone's behalf
  fromDate: isoDate("Valid fromDate is required"),
  toDate: isoDate("Valid toDate is required"),
  leaveType: oneOf(LEAVE_TYPES, `leaveType must be one of: ${LEAVE_TYPES.join(", ")}`).default("cl"),
  reason: optionalText(),
  // One day, half of it: "first" | "second" (counts 0.5)
  halfDay: z.preprocess((v) => v || undefined, z.enum(["first", "second"], { errorMap: () => ({ message: "halfDay must be first or second" }) }).optional()),
});

export const leaveStatusSchema = z.object({
  status: oneOf(["approved", "rejected"], "Status must be 'approved' or 'rejected'"),
  // Shown to the employee (why approved / rejected)
  note: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(500, "Note can be at most 500 characters").optional()),
});

const quota = (label: string, max: number) => numberField(`${label} must be a number from 0 to ${max}`, { min: 0, max });

export const leavePolicySchema = z.object({
  clPerYear: quota("CL per year", 365),
  slPerYear: quota("SL per year", 365),
  olPerYear: quota("OL per year", 365),
  elPerMonth: quota("EL per month", 31),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type LeaveStatusInput = z.infer<typeof leaveStatusSchema>;
export type LeavePolicyInput = z.infer<typeof leavePolicySchema>;
