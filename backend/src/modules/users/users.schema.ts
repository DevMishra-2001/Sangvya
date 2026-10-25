import { z } from "zod";
import { ROLES } from "../../config/permissions.js";
import { strongPassword } from "../../utils/passwordPolicy.js";
import { oneOf, optionalId, requiredText } from "../../utils/zod.js";

const role = oneOf(ROLES, `Role must be one of: ${ROLES.join(", ")}`);

export const createUserSchema = z.object({
  name: requiredText("Name is required"),
  email: z.string().trim().email("Valid email is required"),
  password: strongPassword,
  role,
  employeeId: optionalId("Invalid employeeId"),
});

export const updateUserSchema = z.object({
  name: requiredText("Name is required").optional(),
  role: role.optional(),
  employeeId: optionalId("Invalid employeeId"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
