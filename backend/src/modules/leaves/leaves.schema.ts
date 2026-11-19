import { z } from "zod";
import { isoDate, numberField, oneOf, optionalId, optionalText } from "../../utils/zod.js";

// cl (casual) | sl (sick) | ol (optional) | el (earned) | comp_off (earned by working a Sunday/holiday)
// "leave" (general) is kept for older requests.
export const LEAVE_TYPES = ["leave", "cl", "sl", "ol", "el", "comp_off"] as const;

export const applyLeaveSchema = z.object({
  employeeId: optionalId("Invalid employeeId"), // HR applying on someone's behalf
  fromDate: isoDate("Valid fromDate is required"),
  toDate: isoDate("Valid toDate is required"),
  // A code from the company's leave types (Leave Settings)
  leaveType: z.string().trim().regex(/^[a-z][a-z0-9_]{0,19}$/, "Pick a leave type").default("cl"),
  attachments: z.array(z.object({ path: z.string().max(500), name: z.string().max(255) })).max(5).default([]),
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
  compOffValidDays: numberField("Comp off validity must be 1 to 365 days", { min: 1, max: 365 }).optional(),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type LeaveStatusInput = z.infer<typeof leaveStatusSchema>;
export type LeavePolicyInput = z.infer<typeof leavePolicySchema>;

// ---- Leave Settings ----
const days = (max: number) => z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(0).max(max).nullable());
export const leaveTypeSchema = z
  .object({
    code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{0,19}$/, "Code: small letters, numbers or _ (e.g. ml)").refine((c) => !["types", "financialyear", "leaveyear"].includes(c), "That code is reserved"),
    name: z.string().trim().min(2, "Name the leave type").max(60),
    shortName: z.string().trim().min(1, "Give a short name (e.g. ML)").max(12),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
    kind: z.enum(["quota", "comp_off", "unpaid"]),
    isPaid: z.boolean(),
    quota: z.coerce.number().min(0).max(365),
    quotaPeriod: z.enum(["year", "month", "none"]),
    carryForward: z.enum(["none", "all", "max"]),
    carryMax: days(365),
    allowHalfDay: z.boolean(),
    gender: z.enum(["all", "female", "male"]),
    afterProbation: z.boolean(),
    minNoticeDays: days(365),
    maxDaysPerRequest: days(365),
    documentAfterDays: days(365),
    optionalHolidaysOnly: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine((v) => v.carryForward !== "max" || v.carryMax != null, { path: ["carryMax"], message: "Set the most days to carry" });

export const leaveRulesSchema = z.object({
  leaveYear: z.enum(["calendar", "financial"]),
  sandwichRule: z.boolean(),
  backdatedDays: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(365).nullable()),
  whenShort: z.enum(["block", "unpaid"]),
  compOffValidDays: z.coerce.number().int().min(1).max(365),
  compOffFullMinutes: z.coerce.number().int().min(0).max(1440),
  compOffHalfMinutes: z.coerce.number().int().min(0).max(1440),
});
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
export type LeaveRulesInput = z.infer<typeof leaveRulesSchema>;
