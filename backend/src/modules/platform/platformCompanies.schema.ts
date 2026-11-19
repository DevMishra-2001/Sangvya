import { z } from "zod";

export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export const COMPANY_STATUSES = ["active", "suspended"] as const;

const note = z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(1000, "At most 1000 characters").optional());

// Verify / reject / mark in review (a rejection must say why)
export const verificationSchema = z
  .object({
    status: z.enum(VERIFICATION_STATUSES, { errorMap: () => ({ message: `Status must be one of: ${VERIFICATION_STATUSES.join(", ")}` }) }),
    notes: note,
  })
  .refine((v) => v.status !== "rejected" || v.notes, { path: ["notes"], message: "Add a note saying why it's rejected" });

// Suspend / reactivate (a suspension must say why)
export const companyStatusSchema = z
  .object({
    status: z.enum(COMPANY_STATUSES, { errorMap: () => ({ message: "Status must be active or suspended" }) }),
    reason: note,
  })
  .refine((v) => v.status !== "suspended" || v.reason, { path: ["reason"], message: "Give a reason for the suspension" });

// Custom deal: move the trial end date and / or the price per employee
export const subscriptionSchema = z
  .object({
    trialEndsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").optional(),
    pricePerEmployee: z.coerce.number().min(0, "Price can't be negative").max(100000).optional(),
  })
  .refine((v) => v.trialEndsOn !== undefined || v.pricePerEmployee !== undefined, "Nothing to change");

export const notesSchema = z.object({ notes: note.nullable() });
export const resetSchema = z.object({ userId: z.coerce.number().int().positive() });

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
export type VerificationInput = z.infer<typeof verificationSchema>;
export type CompanyStatusInput = z.infer<typeof companyStatusSchema>;
