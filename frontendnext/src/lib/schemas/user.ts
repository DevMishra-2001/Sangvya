import { z } from "zod";
import { strongPassword } from "@/lib/password-policy";
import { email, requiredText } from "./common";

// A login is always linked to an employee — their designation decides what they can open
export const userSchema = z.object({
  employeeId: z.string().min(1, "Choose the employee this login is for").transform(Number),
  name: requiredText("Name is required", 150),
  email,
  password: strongPassword,
});

export type UserForm = z.input<typeof userSchema>;
export type UserPayload = z.output<typeof userSchema>;
