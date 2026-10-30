import { z } from "zod";
import { idField, isoDate, oneOf } from "../../utils/zod.js";

export const markAttendanceSchema = z.object({
  employeeId: idField("Valid employeeId is required"),
  date: isoDate("Valid date is required"),
  status: oneOf(["present", "absent", "half"], "Status must be present, absent, or half"),
});

export const attendanceByDateQuery = z.object({
  date: isoDate("Valid date is required"),
});

export const employeeAttendanceParams = z.object({
  employeeId: idField("Valid employeeId is required"),
});

export const employeeAttendanceQuery = z.object({
  from: isoDate("Valid from date is required"),
  to: isoDate("Valid to date is required"),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

const clock = (label: string) => z.string({ required_error: `${label} is required` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} must be a time like 09:30`);

// POST /api/me/corrections — fix a past day's check-in / check-out
export const correctionSchema = z.object({
  date: isoDate("Pick the day to correct"),
  punchIn: clock("Check-in time"),
  punchOut: clock("Check-out time"), // earlier than check-in = the next morning (night shift)
  reason: z.string({ required_error: "Say why the day needs correcting" }).trim().min(5, "Say why the day needs correcting (at least 5 characters)").max(500, "Reason can be at most 500 characters"),
});
export type CorrectionInput = z.infer<typeof correctionSchema>;

// PATCH /api/attendance/corrections/:id
export const correctionDecisionSchema = z.object({
  status: oneOf(["approved", "rejected"], "Status must be approved or rejected"),
  note: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(500, "Note can be at most 500 characters").optional()),
});
export type CorrectionDecisionInput = z.infer<typeof correctionDecisionSchema>;

export const correctionListQuery = z.object({
  status: z.preprocess((v) => v || undefined, z.enum(["pending", "approved", "rejected", "all"]).default("pending")),
});
