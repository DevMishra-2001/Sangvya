import { z } from "zod";
import { strongPassword } from "../../utils/passwordPolicy.js";
import { idField, optionalId, requiredText } from "../../utils/zod.js";

// A login is always linked to an employee: what they can open comes from that
// employee's role (Page Master).
export const createUserSchema = z.object({
  name: requiredText("Name is required"),
  email: z.string().trim().email("Valid email is required"),
  password: strongPassword,
  employeeId: idField("Choose the employee this login is for"),
});

export const updateUserSchema = z.object({
  name: requiredText("Name is required").optional(),
  employeeId: optionalId("Invalid employeeId"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
