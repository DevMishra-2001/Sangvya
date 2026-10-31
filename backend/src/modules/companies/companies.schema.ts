import { CODE_FORMAT_KEYS } from "../../utils/employeeCode.js";
import { z } from "zod";
import {
  ATTENDANCE_MODES,
  BUSINESS_TYPES,
  CIN_RE,
  CURRENCIES,
  EMPLOYEE_RANGES,
  LEAVE_YEARS,
  LLPIN_RE,
  PAN_REQUIRED,
  TAN_RE,
  WEEK_DAYS,
  gstinProblem,
  panProblem,
} from "../../utils/companyRules.js";
import { optionalImageUrl } from "../../utils/imageUrl.js";
import { idField, requiredText } from "../../utils/zod.js";

export { EMPLOYEE_RANGES };

const blank = (v: unknown) => (typeof v === "string" ? v.trim() : v) || undefined;
const optional = (max: number) => z.preprocess(blank, z.string().max(max).optional());
const upper = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v) || undefined, z.string().max(max).optional());
const oneOf = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.preprocess(blank, z.enum(values, { errorMap: (issue) => ({ message: issue.code === "invalid_type" ? `${label} is required` : `Choose a valid ${label.toLowerCase()}` }) }));
const time = (label: string) => z.string({ required_error: `${label} is required` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} must be a time like 09:30`);

// Company setup (onboarding wizard): Basic · Contact & address · Legal & billing · Workplace
export const createCompanySchema = z
  .object({
    // ---- Basic ----
    companyName: requiredText("Company name is required", 200),
    legalName: optional(200),
    industry: requiredText("Industry is required", 100),
    businessType: oneOf(BUSINESS_TYPES, "Business type"),
    employeeRange: oneOf(EMPLOYEE_RANGES, "Company size"),
    website: z.preprocess(blank, z.string().url("Website must be a full link, e.g. https://example.com").max(500).optional()),
    logoUrl: optionalImageUrl("Upload the logo first"),
    yearEstablished: z.preprocess(blank, z.coerce.number().int().min(1800, "Enter a valid year").max(new Date().getFullYear(), "Year can't be in the future").optional()),

    // ---- Contact & address ----
    email: z.preprocess(blank, z.string({ required_error: "Official email is required" }).email("Enter a valid email").max(150)),
    phone: z.preprocess(blank, z.string({ required_error: "Contact phone is required" }).regex(/^[+\d][\d\s()-]{5,}$/, "Enter a valid phone number").max(30)),
    country: requiredText("Country is required", 100),
    state: requiredText("State is required", 100),
    city: requiredText("City is required", 100),
    address: requiredText("Registered address is required", 500),
    postalCode: requiredText("Postal code is required", 20),
    officeLocations: optional(1000),
    timezone: requiredText("Timezone is required", 60),

    // ---- Legal & billing ----
    pan: upper(10),
    gstin: upper(15),
    cinLlpin: upper(21),
    tan: upper(10),
    billingAddress: requiredText("Billing address is required", 500),

    // ---- Workplace ----
    workDays: z.array(z.enum(WEEK_DAYS), { required_error: "Pick the working days" }).min(1, "Pick at least one working day"),
    officeStart: time("Office start time"),
    officeEnd: time("Office end time"),
    attendanceMode: oneOf(ATTENDANCE_MODES, "Attendance mode"),
    leaveYear: oneOf(LEAVE_YEARS, "Leave year"),
    fiscalYearStart: z.preprocess(blank, z.coerce.number().int().min(1).max(12).optional()),
    currency: oneOf(CURRENCIES, "Currency"),
    employeeCodeFormat: z.enum(CODE_FORMAT_KEYS, { errorMap: () => ({ message: "Pick an employee code format" }) }).default("prefix_seq"),
    employeeCodeDigits: z.coerce.number().int().min(2, "Digits must be 2 to 6").max(6, "Digits must be 2 to 6").default(3),
    employeeIdPrefix: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toUpperCase() : v) || undefined,
      z.string().regex(/^[A-Z0-9-]{1,10}$/, "Up to 10 letters, numbers or dashes, e.g. ACME-").optional(),
    ),
  })
  .superRefine((v, ctx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const india = v.country.trim().toLowerCase() === "india";
    if (india && PAN_REQUIRED.includes(v.businessType) && !v.pan) add("pan", "Company PAN is required for this business type");
    if (v.pan) {
      const problem = panProblem(v.pan, v.businessType);
      if (problem) add("pan", problem);
    }
    if (v.gstin) {
      const problem = gstinProblem(v.gstin, v.pan);
      if (problem) add("gstin", problem);
    }
    if (v.cinLlpin && !CIN_RE.test(v.cinLlpin) && !LLPIN_RE.test(v.cinLlpin)) add("cinLlpin", "Enter a 21-character CIN (e.g. U72900KA2020PTC123456) or an LLPIN (e.g. AAB-1234)");
    if (v.tan && !TAN_RE.test(v.tan)) add("tan", "TAN looks like ABCD12345E (4 letters, 5 digits, 1 letter)");
    if (v.officeStart >= v.officeEnd) add("officeEnd", "End time must be after the start time");
  });

export const companyIdParams = z.object({ id: idField() });

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
