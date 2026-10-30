import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "../../db/schemas/employeeDocument.schema.js";
import { EMPLOYMENT_TYPES, EXIT_REASONS } from "../../db/schemas/employee.schema.js";
import { optionalImageUrl } from "../../utils/imageUrl.js";
import { strongPassword } from "../../utils/passwordPolicy.js";
import { idField, optionalId, optionalIsoDate, optionalNumber, optionalText, requiredText } from "../../utils/zod.js";

// Used for both create (POST) and update (PUT) — the form always sends every field.
export const employeeSchema = z.object({
  name: requiredText("Name is required"),
  // Job title from the company's list (no effect on access)
  designationId: optionalId("Invalid designation"),
  // Older clients send the job title as text; it's matched (or added) by name
  designation: optionalText(),
  // System role — what they can open and do
  roleId: optionalId("Invalid role"),
  // Working hours; empty = the company's default shift
  shiftId: optionalId("Invalid shift"),
  // Department from the company's list
  departmentId: optionalId("Invalid department"),
  // Older clients send the department as text; it's matched (or added) by name
  department: optionalText(),
  email: optionalText(),
  joinDate: optionalIsoDate("Invalid join date"),
  salary: optionalNumber("Salary must be a positive number", { min: 0 }),
  managerId: optionalId("Invalid manager"),
  dateOfBirth: optionalIsoDate("Invalid date of birth"),
  olQuota: optionalNumber("Optional leaves per year must be a number from 0 to 365", { min: 0, max: 365 }),
  photoUrl: optionalImageUrl(),
  phone: optionalText(),
  gender: z.preprocess((v) => v || null, z.enum(["male", "female", "other"], { errorMap: () => ({ message: "Gender must be male, female or other" }) }).nullish()),
  address: optionalText(),
  employmentType: z.preprocess(
    (v) => v || "full_time",
    z.enum(EMPLOYMENT_TYPES, { errorMap: () => ({ message: "Employment type must be full time, part time, contract or intern" }) }),
  ),
  emergencyContactName: optionalText(),
  emergencyContactPhone: optionalText(),
  // Login: a password creates the employee's login (with their email) or sets a
  // new one; empty = leave as is. loginBlocked stops them from logging in.
  password: z.preprocess((v) => v || undefined, strongPassword.optional()),
  loginBlocked: z.boolean().optional(),
  employeeCode: z
    .string({ invalid_type_error: "Employee code can be at most 40 characters" })
    .trim()
    .max(40, "Employee code can be at most 40 characters")
    .nullish(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

// POST /api/employees/:id/exit
export const exitSchema = z.object({
  lastWorkingDay: z.string({ required_error: "Last working day is required" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Last working day must be a date (YYYY-MM-DD)"),
  reason: z.enum(EXIT_REASONS, { errorMap: () => ({ message: `Reason must be one of: ${EXIT_REASONS.join(", ")}` }) }),
  notes: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(1000, "Notes can be at most 1000 characters").optional()),
});
export type ExitInput = z.infer<typeof exitSchema>;

// multipart text fields sent with a document upload
export const documentSchema = z.object({
  name: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(150, "Name can be at most 150 characters").optional()),
  category: z.preprocess(
    (v) => v || "other",
    z.enum(DOCUMENT_CATEGORIES, { errorMap: () => ({ message: `Category must be one of: ${DOCUMENT_CATEGORIES.join(", ")}` }) }),
  ),
});
export type DocumentInput = z.infer<typeof documentSchema>;

export const documentParams = z.object({ id: idField(), docId: idField("Invalid document") });
