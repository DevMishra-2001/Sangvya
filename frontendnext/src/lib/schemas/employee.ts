import { z } from "zod";
import { passwordError } from "@/lib/password-policy";
import { normalizePhone, PHONE_MESSAGE } from "@/lib/phone";
import { optionalDate, optionalId, optionalNumber, optionalText, requiredText } from "./common";

// Optional phone, normalised like the backend ("" → null)
const phone = (message = PHONE_MESSAGE) =>
  optionalText(30)
    .refine((v) => v === null || normalizePhone(v) !== null, message)
    .transform((v) => (v === null ? null : normalizePhone(v)));
const emailOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email")
  .transform((v) => v || null);
// Upper-cased, spaces removed, checked against a pattern; "" → null
const idField = (re: RegExp, message: string, strip = /\s+/g) =>
  z
    .string()
    .transform((v) => v.replace(strip, "").toUpperCase())
    .refine((v) => v === "" || re.test(v), message)
    .transform((v) => v || null);
const choice = z.string().transform((v) => v || null);

// Statutory IDs + bank (also used by the self-onboarding form)
export const privateFields = {
  pan: idField(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN looks like ABCPE1234F"),
  aadhaar: idField(/^[2-9][0-9]{11}$/, "Aadhaar is 12 digits"),
  uan: idField(/^[0-9]{12}$/, "UAN is 12 digits"),
  pfNumber: optionalText(30),
  esiNumber: idField(/^[0-9]{10,17}$/, "ESI number is 10 to 17 digits"),
  passportNumber: idField(/^[A-Z0-9]{6,20}$/, "Enter a valid passport number"),
  bankName: optionalText(120),
  bankBranch: optionalText(120),
  ifsc: idField(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC looks like SBIN0001234"),
  accountNumber: idField(/^[0-9]{9,18}$/, "Account number is 9 to 18 digits", /[\s-]+/g),
  accountHolder: optionalText(150),
  accountType: choice,
};

// Personal + address + emergency (also used by the self-onboarding form)
export const selfFields = {
  phone: phone(),
  personalEmail: emailOrEmpty,
  dateOfBirth: optionalDate,
  gender: choice,
  maritalStatus: choice,
  bloodGroup: choice,
  nationality: optionalText(60),
  address: optionalText(500),
  addressLine2: optionalText(300),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(10),
  country: optionalText(100),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: phone("Enter a valid emergency contact number (10-digit mobile or +country code)"),
  emergencyContactRelation: choice,
};

export const PRIVATE_KEYS = Object.keys(privateFields) as (keyof typeof privateFields)[];

export const employeeSchema = z
  .object({
    ...selfFields,
    ...privateFields,
    privateLoaded: z.boolean(), // false = couldn't read them, so don't overwrite
    photoUrl: z.string().nullable(),
    name: requiredText("Name is required", 150),
    employeeCode: optionalText(40),
    designationId: optionalId, // job title
    // Role (access). Empty = not sent: a new employee gets Employee, an edit keeps the current one
    roleId: z.string().transform((v) => (v ? Number(v) : undefined)),
    departmentId: optionalId,
    shiftId: optionalId, // empty = company default shift
    branchId: optionalId,
    businessUnit: optionalText(100),
    workMode: choice,
    email: emailOrEmpty,
    olQuota: optionalNumber("Optional leaves per year must be a number from 0 to 365", { min: 0, max: 365 }),
    managerId: optionalId,
    joinDate: optionalDate,
    probationEndDate: optionalDate,
    salary: optionalNumber("Salary must be a positive number", { min: 0 }),
    employmentType: z.enum(["full_time", "part_time", "contract", "intern"]),
    // Login: a password creates their login (or sets a new one); "" = leave as is.
    // It's temporary — they must choose their own on first login.
    password: z
      .string()
      .refine((v) => v === "" || passwordError(v) === null, (v) => ({ message: passwordError(v) ?? "Invalid password" }))
      .transform((v) => v || undefined),
    loginAccess: z.enum(["allowed", "blocked"]),
  })
  // They log in with their email, so a new login needs one
  .refine((v) => !v.password || v.email, { path: ["email"], message: "Add an email — they log in with it" })
  .refine((v) => !v.probationEndDate || !v.joinDate || v.probationEndDate > v.joinDate, { path: ["probationEndDate"], message: "Must be after the joining date" })
  .transform(({ loginAccess, privateLoaded, pan, aadhaar, uan, pfNumber, esiNumber, passportNumber, bankName, bankBranch, ifsc, accountNumber, accountHolder, accountType, ...v }) => ({
    ...v,
    loginBlocked: loginAccess === "blocked",
    private: privateLoaded ? { pan, aadhaar, uan, pfNumber, esiNumber, passportNumber, bankName, bankBranch, ifsc, accountNumber, accountHolder, accountType } : undefined,
  }));

export type EmployeeForm = z.input<typeof employeeSchema>;
export type EmployeePayload = z.output<typeof employeeSchema>;
