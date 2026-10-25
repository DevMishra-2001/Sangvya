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
});

export const leaveStatusSchema = z.object({
  status: oneOf(["approved", "rejected"], "Status must be 'approved' or 'rejected'"),
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
