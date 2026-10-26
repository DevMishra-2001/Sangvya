import { z } from "zod";
import { passwordError } from "@/lib/password-policy";
import { optionalDate, optionalId, optionalNumber, optionalText, requiredText } from "./common";

export const employeeSchema = z
  .object({
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
    phone: optionalText(30).refine((v) => v === null || /^[+\d][\d\s()-]{5,}$/.test(v), "Enter a valid phone number"),
    gender: z.enum(["", "male", "female", "other"]).transform((v) => v || null),
    address: optionalText(500),
    dateOfBirth: optionalDate,
    olQuota: optionalNumber("Optional leaves per year must be a number from 0 to 365", { min: 0, max: 365 }),
    managerId: optionalId,
    joinDate: optionalDate,
    salary: optionalNumber("Salary must be a positive number", { min: 0 }),
    // Login: a password creates their login (or sets a new one); "" = leave as is
    password: z
      .string()
      .refine((v) => v === "" || passwordError(v) === null, (v) => ({ message: passwordError(v) ?? "Invalid password" }))
      .transform((v) => v || undefined),
    loginAccess: z.enum(["allowed", "blocked"]),
  })
  // They log in with their email, so a new login needs one
  .refine((v) => !v.password || v.email, { path: ["email"], message: "Add an email — they log in with it" })
  .transform(({ loginAccess, ...v }) => ({ ...v, loginBlocked: loginAccess === "blocked" }));

export type EmployeeForm = z.input<typeof employeeSchema>;
export type EmployeePayload = z.output<typeof employeeSchema>;
