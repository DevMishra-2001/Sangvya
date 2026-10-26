import { z } from "zod";
import { optionalText, requiredText } from "./common";

// Headcount bands (same values as the backend's EMPLOYEE_RANGES)
export const EMPLOYEE_RANGES = [
  { value: "2-10", label: "2 – 10" },
  { value: "11-50", label: "11 – 50" },
  { value: "51-200", label: "51 – 200" },
  { value: "201-500", label: "201 – 500" },
  { value: "501-1000", label: "501 – 1,000" },
  { value: "1000+", label: "1,000+" },
] as const;

export const INDUSTRIES = [
  "IT services",
  "Software / SaaS",
  "Manufacturing",
  "Healthcare",
  "Education",
  "Finance",
  "Retail / E-commerce",
  "Construction",
  "Consulting",
  "Logistics",
  "Hospitality",
  "Marketing / Media",
];

// "example.com" → "https://example.com"
const website = z
  .string()
  .trim()
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => v === "" || z.string().url().safeParse(v).success, "Enter a valid website, e.g. example.com")
  .transform((v) => v || null);

export const companySchema = z.object({
    logoUrl: z.string().nullable(),
    companyName: requiredText("Company name is required", 200),
    industry: optionalText(100),
    employeeRange: z.string().min(1, "Choose your company size"),
    website,
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email")
      .transform((v) => v || null),
    phone: optionalText(30).refine((v) => v === null || /^[+\d][\d\s()-]{5,}$/.test(v), "Enter a valid phone number"),
    address: optionalText(500),
    city: optionalText(100),
    state: optionalText(100),
    country: optionalText(100),
    postalCode: optionalText(20),
  });

export type CompanyForm = z.input<typeof companySchema>;
export type CompanyInput = z.output<typeof companySchema>;
