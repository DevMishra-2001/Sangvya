import { z } from "zod";
import { optionalDate, optionalId, optionalNumber, optionalText, requiredText } from "./common";

export const employeeSchema = z.object({
  photoUrl: z.string().nullable(),
  name: requiredText("Name is required", 150),
  employeeCode: optionalText(40),
  designationId: optionalId,
  department: optionalText(100),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email")
    .transform((v) => v || null),
  dateOfBirth: optionalDate,
  olQuota: optionalNumber("Optional leaves per year must be a number from 0 to 365", { min: 0, max: 365 }),
  managerId: optionalId,
  joinDate: optionalDate,
  salary: optionalNumber("Salary must be a positive number", { min: 0 }),
});

export type EmployeeForm = z.input<typeof employeeSchema>;
export type EmployeePayload = z.output<typeof employeeSchema>;
