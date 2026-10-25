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
