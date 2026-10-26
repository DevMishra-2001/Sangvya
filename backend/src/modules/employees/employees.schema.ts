import { z } from "zod";
import { optionalImageUrl } from "../../utils/imageUrl.js";
import { strongPassword } from "../../utils/passwordPolicy.js";
import { optionalId, optionalIsoDate, optionalNumber, optionalText, requiredText } from "../../utils/zod.js";

// Used for both create (POST) and update (PUT) — the form always sends every field.
export const employeeSchema = z.object({
  name: requiredText("Name is required"),
  designationId: optionalId("Invalid designation"),
  // Older clients send the designation as text; it's matched (or added) by name
  designation: optionalText(),
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
