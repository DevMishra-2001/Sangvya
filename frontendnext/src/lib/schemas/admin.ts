import { z } from "zod";
import { strongPassword } from "@/lib/password-policy";
import { email, requiredText } from "./common";

// A company owner's login (created by the Super Admin)
export const adminSchema = z.object({
  name: requiredText("Name is required", 150),
  email,
  password: strongPassword,
});

export type AdminInput = z.infer<typeof adminSchema>;
