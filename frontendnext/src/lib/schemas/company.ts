import { z } from "zod";
import { CIN_RE, LLPIN_RE, PAN_REQUIRED, TAN_RE, gstinProblem, panProblem } from "@/lib/company-rules";

// Company setup wizard. Form values are strings; the output is what POST /api/companies takes.
const text = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`);
const required = (label: string, max: number) => text(max).min(1, `${label} is required`);
const optional = (max: number) => text(max).transform((v) => v || undefined);
const upper = (max: number) => z.string().trim().toUpperCase().max(max).transform((v) => v || undefined);

export const companySchema = z
  .object({
    // ---- Basic ----
    logoUrl: z.string().nullable(),
    companyName: required("Company / brand name", 200),
    legalName: optional(200),
    industry: required("Industry", 100),
    businessType: z.string().min(1, "Business type is required"),
    employeeRange: z.string().min(1, "Choose your company size"),
    website: z
      .string()
      .trim()
      .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
      .refine((v) => v === "" || z.string().url().safeParse(v).success, "Enter a valid website, e.g. example.com")
      .transform((v) => v || undefined),
    yearEstablished: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1800 && Number(v) <= new Date().getFullYear()), "Enter a year like 2015")
      .transform((v) => (v ? Number(v) : undefined)),

    // ---- Contact & address ----
    email: z.string().trim().min(1, "Official email is required").email("Enter a valid email"),
    phone: z.string().trim().min(1, "Contact phone is required").regex(/^[+\d][\d\s()-]{5,}$/, "Enter a valid phone number"),
    country: required("Country", 100),
    state: required("State", 100),
    city: required("City", 100),
    address: required("Registered address", 500),
    postalCode: required("Postal code", 20),
    officeLocations: optional(1000),
    timezone: z.string().min(1, "Timezone is required"),

    // ---- Legal & billing ----
    pan: upper(10),
    gstin: upper(15),
    cinLlpin: upper(21),
    tan: upper(10),
    billingSame: z.boolean(),
    billingAddress: text(500),

    // ---- Workplace ----
    workDays: z.array(z.string()).min(1, "Pick at least one working day"),
    officeStart: z.string().min(1, "Start time is required"),
    officeEnd: z.string().min(1, "End time is required"),
    attendanceMode: z.string().min(1, "Attendance mode is required"),
    leaveYear: z.string().min(1, "Leave year is required"),
    fiscalYearStart: z.string().transform((v) => (v ? Number(v) : undefined)),
    currency: z.string().min(1, "Currency is required"),
    employeeIdPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z0-9-]{1,10}$/.test(v), "Up to 10 letters, numbers or dashes, e.g. ACME-")
      .transform((v) => v || undefined),
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
    if (v.cinLlpin && !CIN_RE.test(v.cinLlpin) && !LLPIN_RE.test(v.cinLlpin)) add("cinLlpin", "Enter a CIN (e.g. U72900KA2020PTC123456) or an LLPIN (e.g. AAB-1234)");
    if (v.tan && !TAN_RE.test(v.tan)) add("tan", "TAN looks like ABCD12345E");
    if (!v.billingSame && !v.billingAddress) add("billingAddress", "Billing address is required");
    if (v.officeStart && v.officeEnd && v.officeStart >= v.officeEnd) add("officeEnd", "End time must be after the start time");
  })
  .transform(({ billingSame, ...v }) => ({
    ...v,
    logoUrl: v.logoUrl || undefined,
    billingAddress: billingSame ? v.address : v.billingAddress,
  }));

export type CompanyForm = z.input<typeof companySchema>;
export type CompanyInput = z.output<typeof companySchema>;

// The wizard's steps and the fields each one checks before moving on
export const COMPANY_STEPS = [
  { key: "basic", title: "Basic details", hint: "Who you are", fields: ["companyName", "legalName", "industry", "businessType", "employeeRange", "website", "yearEstablished"] },
  { key: "contact", title: "Contact & address", hint: "Where you are", fields: ["email", "phone", "country", "state", "city", "address", "postalCode", "officeLocations", "timezone"] },
  { key: "legal", title: "Legal & billing", hint: "Tax and invoicing", fields: ["pan", "gstin", "cinLlpin", "tan", "billingAddress"] },
  { key: "workplace", title: "Workplace", hint: "How you work", fields: ["workDays", "officeStart", "officeEnd", "attendanceMode", "leaveYear", "fiscalYearStart", "currency", "employeeIdPrefix"] },
] as const satisfies readonly { key: string; title: string; hint: string; fields: readonly (keyof CompanyForm)[] }[];

export const EMPTY_COMPANY: CompanyForm = {
  logoUrl: null,
  companyName: "",
  legalName: "",
  industry: "",
  businessType: "",
  employeeRange: "",
  website: "",
  yearEstablished: "",
  email: "",
  phone: "",
  country: "India",
  state: "",
  city: "",
  address: "",
  postalCode: "",
  officeLocations: "",
  timezone: "Asia/Kolkata",
  pan: "",
  gstin: "",
  cinLlpin: "",
  tan: "",
  billingSame: true,
  billingAddress: "",
  workDays: ["mon", "tue", "wed", "thu", "fri"],
  officeStart: "09:30",
  officeEnd: "18:30",
  attendanceMode: "office",
  leaveYear: "financial",
  fiscalYearStart: "4",
  currency: "INR",
  employeeIdPrefix: "",
};
