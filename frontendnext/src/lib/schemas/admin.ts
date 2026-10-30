import { z } from "zod";
import { email, optionalText, requiredText } from "./common";

// Invite a company owner — they set their own password from the activation link
export const adminSchema = z.object({
  name: requiredText("Name is required", 150),
  email,
  companyName: optionalText(200),
});

export type AdminForm = z.input<typeof adminSchema>;
export type AdminInput = z.output<typeof adminSchema>;
