import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// Add / edit a department
export const departmentSchema = z.object({
  name: requiredText("Department name is required", 100),
  code: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v) || null,
    z.string().regex(/^[A-Z0-9-]{1,20}$/, "Code: up to 20 letters, numbers or dashes, e.g. ENG").nullable(),
  ),
  headId: z.preprocess(blank, z.coerce.number({ invalid_type_error: "Choose a valid head" }).int().positive().nullish()),
  isActive: z.boolean({ invalid_type_error: "isActive must be true or false" }).default(true),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
