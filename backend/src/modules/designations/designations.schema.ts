import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

// Add / edit a company job title
export const designationSchema = z.object({
  name: requiredText("Designation name is required", 100),
  isActive: z.boolean({ invalid_type_error: "isActive must be true or false" }).default(true),
});

export type DesignationInput = z.infer<typeof designationSchema>;
