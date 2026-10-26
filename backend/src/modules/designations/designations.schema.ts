import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

// PATCH: rename and/or switch active on or off
export const updateDesignationSchema = z
  .object({
    name: requiredText("Designation name is required", 100).optional(),
    isActive: z.boolean({ invalid_type_error: "isActive must be true or false" }).optional(),
  })
  .refine((v) => v.name !== undefined || v.isActive !== undefined, { message: "Nothing to update" });

export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;
