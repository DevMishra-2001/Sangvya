import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

// Invite a company owner. No password here: they set their own from the
// activation link. companyName only pre-fills their company setup form.
export const inviteAdminSchema = z.object({
  name: requiredText("Name is required", 150),
  email: z.string({ required_error: "Valid email is required" }).trim().toLowerCase().email("Valid email is required"),
  companyName: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || undefined, z.string().max(200, "Company name can be at most 200 characters").optional()),
});

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
