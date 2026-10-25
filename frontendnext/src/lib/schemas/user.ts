import { z } from "zod";
import { strongPassword } from "@/lib/password-policy";
import { ROLES } from "@/lib/permissions";
import { email, optionalId, requiredText } from "./common";

export const userSchema = z.object({
  employeeId: optionalId,
  name: requiredText("Name is required", 150),
  email,
  password: strongPassword,
  role: z.enum(ROLES, { errorMap: () => ({ message: "Choose a role" }) }),
});

export type UserForm = z.input<typeof userSchema>;
export type UserPayload = z.output<typeof userSchema>;
