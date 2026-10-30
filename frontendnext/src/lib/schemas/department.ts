import { z } from "zod";
import { requiredText } from "./common";

export const departmentSchema = z
  .object({
    name: requiredText("Department name is required", 100),
    code: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[A-Za-z0-9-]{1,20}$/.test(v), "Up to 20 letters, numbers or dashes, e.g. ENG"),
    headId: z.string(), // "" = no head
    status: z.enum(["active", "inactive"]),
  })
  .transform(({ name, code, headId, status }) => ({
    name,
    code: code ? code.toUpperCase() : null,
    headId: headId ? Number(headId) : null,
    isActive: status === "active",
  }));

export type DepartmentForm = z.input<typeof departmentSchema>;
export type DepartmentPayload = z.output<typeof departmentSchema>;
