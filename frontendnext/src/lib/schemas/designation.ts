import { z } from "zod";
import { requiredText } from "./common";

export const designationSchema = z.object({
  name: requiredText("Designation name is required", 100),
  // Select value: "active" | "inactive"
  status: z.enum(["active", "inactive"]),
});

export type DesignationInput = z.infer<typeof designationSchema>;
