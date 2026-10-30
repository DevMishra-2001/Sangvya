import { z } from "zod";
import { requiredText } from "./common";

export const CUSTOM_ROLE_BASES = ["hr", "accountant", "employee"] as const;

export const customRoleSchema = z
  .object({
    name: requiredText("Role name is required", 100),
    base: z.enum(CUSTOM_ROLE_BASES, { message: "Pick the role it's based on" }),
    description: z.string().trim().max(200, "Description can be at most 200 characters"),
    status: z.enum(["active", "inactive"]),
  })
  .transform(({ name, base, description, status }) => ({ name, base, description: description || null, isActive: status === "active" }));

export type CustomRoleForm = z.input<typeof customRoleSchema>;
export type CustomRolePayload = z.output<typeof customRoleSchema>;
