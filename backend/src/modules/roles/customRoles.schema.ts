import { z } from "zod";
import { CUSTOM_ROLE_BASES } from "../../db/schemas/role.schema.js";
import { requiredText } from "../../utils/zod.js";

// POST / PUT /api/custom-roles
export const customRoleSchema = z.object({
  name: requiredText("Role name is required", 100),
  description: z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || null, z.string().max(200, "Description can be at most 200 characters").nullable()),
  base: z.enum(CUSTOM_ROLE_BASES, { errorMap: () => ({ message: "Based on must be HR, Accountant or Employee" }) }),
  pageIds: z.array(z.number().int().positive(), { invalid_type_error: "Pick the pages" }).max(200),
  isActive: z.boolean().default(true),
});
export type CustomRoleInput = z.infer<typeof customRoleSchema>;
