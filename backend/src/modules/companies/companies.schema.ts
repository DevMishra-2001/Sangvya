import { z } from "zod";
import { optionalImageUrl } from "../../utils/imageUrl.js";
import { idField, optionalText, requiredText } from "../../utils/zod.js";

// Headcount bands offered on the company form
export const EMPLOYEE_RANGES = ["2-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;

const optionalUrl = (message: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().url(message).max(500).optional());

export const createCompanySchema = z.object({
  companyName: requiredText("Company name is required", 200),
  industry: optionalText(),
  logoUrl: optionalImageUrl("Upload the logo first"),
  employeeRange: z.preprocess(
    (v) => v || undefined,
    z.enum(EMPLOYEE_RANGES, { errorMap: () => ({ message: `Company size must be one of: ${EMPLOYEE_RANGES.join(", ")}` }) }).optional(),
  ),
  website: optionalUrl("Website must be a full link, e.g. https://example.com"),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().email("Enter a valid company email").max(150).optional()),
  phone: optionalText(),
  address: optionalText(),
  city: optionalText(),
  state: optionalText(),
  country: optionalText(),
  postalCode: optionalText(),
  // The owner's own job title — one of the default designations, or a new one
  designation: requiredText("Your designation is required", 100),
});

export const companyIdParams = z.object({ id: idField() });

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
