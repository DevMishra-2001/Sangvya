import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "../../db/schemas/employeeDocument.schema.js";
import { BLOOD_GROUPS, EMPLOYMENT_TYPES, EXIT_REASONS, MARITAL_STATUSES, WORK_MODES } from "../../db/schemas/employee.schema.js";
import { BANK_ACCOUNT_TYPES } from "../../db/schemas/employeePrivate.schema.js";
import { optionalImageUrl } from "../../utils/imageUrl.js";
import { strongPassword } from "../../utils/passwordPolicy.js";
import { optionalPhone } from "../../utils/phone.js";
import { idField, optionalId, optionalIsoDate, optionalNumber, optionalText, requiredText } from "../../utils/zod.js";

// "" → null (clears it); undefined stays undefined (not sent)
const blank = (v: unknown) => (v === undefined ? undefined : (typeof v === "string" ? v.trim() : v) || null);
const text = (max: number, label: string) => z.preprocess(blank, z.string().max(max, `${label} can be at most ${max} characters`).nullable().optional());
const oneOf = <T extends readonly [string, ...string[]]>(values: T, message: string) => z.preprocess(blank, z.enum(values, { errorMap: () => ({ message }) }).nullable().optional());
// Upper-cased, spaces removed, then checked against a pattern
const id = (re: RegExp, message: string, strip = /\s+/g) =>
  z.preprocess((v) => (v === undefined ? undefined : (typeof v === "string" ? v.replace(strip, "").toUpperCase() : v) || null), z.string().regex(re, message).nullable().optional());

// Statutory IDs + bank (stored apart, HR / Admin only)
export const privateSchema = z.object({
  pan: id(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN looks like ABCPE1234F"),
  aadhaar: id(/^[2-9][0-9]{11}$/, "Aadhaar is 12 digits"),
  uan: id(/^[0-9]{12}$/, "UAN is 12 digits"),
  pfNumber: text(30, "PF number"),
  esiNumber: id(/^[0-9]{10,17}$/, "ESI number is 10 to 17 digits"),
  passportNumber: id(/^[A-Z0-9]{6,20}$/, "Enter a valid passport number"),
  bankName: text(120, "Bank name"),
  bankBranch: text(120, "Branch"),
  ifsc: id(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC looks like SBIN0001234"),
  accountNumber: id(/^[0-9]{9,18}$/, "Account number is 9 to 18 digits", /[\s-]+/g),
  accountHolder: text(150, "Account holder"),
  accountType: oneOf(BANK_ACCOUNT_TYPES, "Account type must be savings, current or salary"),
});
export type PrivateInput = z.infer<typeof privateSchema>;

// Details an employee may fill in themself (onboarding link)
export const selfDetailsShape = {
  phone: optionalPhone(),
  personalEmail: z.preprocess(blank, z.string().email("Enter a valid personal email").max(150).nullable().optional()),
  dateOfBirth: optionalIsoDate("Invalid date of birth"),
  gender: z.preprocess(blank, z.enum(["male", "female", "other"], { errorMap: () => ({ message: "Gender must be male, female or other" }) }).nullish()),
  maritalStatus: oneOf(MARITAL_STATUSES, "Pick a marital status"),
  bloodGroup: oneOf(BLOOD_GROUPS, "Pick a blood group"),
  nationality: text(60, "Nationality"),
  address: optionalText(),
  addressLine2: text(300, "Address line 2"),
  city: text(100, "City"),
  state: text(100, "State"),
  postalCode: z.preprocess(blank, z.string().regex(/^[0-9A-Za-z -]{3,10}$/, "Enter a valid pincode").nullable().optional()),
  country: text(100, "Country"),
  emergencyContactName: optionalText(),
  emergencyContactPhone: optionalPhone("Enter a valid emergency contact number (10-digit mobile or +country code)"),
  emergencyContactRelation: text(30, "Relationship"),
};

// Used for both create (POST) and update (PUT) — the form always sends every field.
export const employeeSchema = z.object({
  ...selfDetailsShape,
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
  olQuota: optionalNumber("Optional leaves per year must be a number from 0 to 365", { min: 0, max: 365 }),
  photoUrl: optionalImageUrl(),
  employmentType: z.preprocess(
    (v) => v || "full_time",
    z.enum(EMPLOYMENT_TYPES, { errorMap: () => ({ message: "Employment type must be full time, part time, contract or intern" }) }),
  ),
  // Login: a password creates the employee's login (with their email) or sets a
  // new one; empty = leave as is. loginBlocked stops them from logging in.
  password: z.preprocess((v) => v || undefined, strongPassword.optional()),
  loginBlocked: z.boolean().optional(),
  // Work
  branchId: optionalId("Invalid branch"),
  businessUnit: text(100, "Business unit"),
  workMode: oneOf(WORK_MODES, "Work mode must be office, remote, hybrid or field"),
  probationEndDate: optionalIsoDate("Invalid probation end date"),
  // Statutory + bank; missing = leave as is
  private: privateSchema.optional(),
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
