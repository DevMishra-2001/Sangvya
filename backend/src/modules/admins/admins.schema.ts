import { z } from "zod";
import { strongPassword } from "../../utils/passwordPolicy.js";
import { requiredText } from "../../utils/zod.js";

// A company owner's login, created by the Super Admin. They set up their
// company the first time they log in, and become its Admin.
export const createAdminSchema = z.object({
  name: requiredText("Name is required", 150),
  email: z.string({ required_error: "Valid email is required" }).trim().toLowerCase().email("Valid email is required"),
  password: strongPassword,
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
