import { z } from "zod";
import { requiredText } from "./common";

export const designationSchema = z.object({
  name: requiredText("Designation name is required", 100),
});

export type DesignationInput = z.infer<typeof designationSchema>;
