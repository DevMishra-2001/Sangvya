import { z } from "zod";
import { privateSchema, selfDetailsShape } from "../employees/employees.schema.js";

// The employee's own form (onboarding link)
export const onboardingDetailsSchema = z.object({ ...selfDetailsShape, private: privateSchema.optional() });
export type OnboardingDetailsInput = z.infer<typeof onboardingDetailsSchema>;

// HR: POST /api/employees/:id/onboarding-link
export const createLinkSchema = z.object({
  hours: z.coerce.number().refine((h) => [12, 24, 48, 72].includes(h), "Pick 12, 24, 48 or 72 hours").default(24),
  sendEmail: z.boolean().default(false),
});

export const tokenParams = z.object({ token: z.string().min(20).max(100) });
