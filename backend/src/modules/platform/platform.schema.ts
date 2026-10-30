import { z } from "zod";
import { MODULE_KEYS } from "../../config/modules.js";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const auditQuery = z.object({
  action: z.preprocess(blankToUndefined, z.string().trim().max(60).optional()),
  companyId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  before: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).default(50)),
});
export type AuditQuery = z.infer<typeof auditQuery>;

// { modules: { attendance: true, payroll: false, … } } — only the keys sent change
export const modulesSchema = z.object({
  modules: z
    .record(z.string(), z.boolean())
    .refine((m) => Object.keys(m).length > 0, "Send at least one module")
    .refine((m) => Object.keys(m).every((k) => MODULE_KEYS.includes(k)), `Modules must be among: ${MODULE_KEYS.join(", ")}`),
});
export type ModulesInput = z.infer<typeof modulesSchema>;
