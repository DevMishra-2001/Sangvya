import { z } from "zod";
import { PAYROLL_ADJUSTMENT_CATEGORIES } from "../../db/schema.js";
import { idField, numberField, optionalIsoDate, optionalNumber } from "../../utils/zod.js";

const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), z.string().max(max).optional());
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month");

export const salaryStructureSchema = z.object({
  employeeId: idField("Valid employeeId is required"),
  basic: numberField("Basic must be a positive number", { min: 0 }),
  hra: optionalNumber("HRA must be a positive number", { min: 0 }),
  allowances: optionalNumber("Allowances must be a positive number", { min: 0 }),
  components: z
    .array(z.object({ label: z.string().trim().min(1, "Name the component").max(60), amount: z.coerce.number().min(0).max(10_000_000) }))
    .max(15, "At most 15 components")
    .optional(),
  ctcAnnual: optionalNumber("CTC must be a positive number", { min: 0 }),
  effectiveFrom: optionalIsoDate("Invalid effective date"),
  note: text(200),
});

export const runPayrollSchema = z.object({
  month: numberField("Month must be 1-12", { min: 1, max: 12, int: true }),
  year: numberField("Valid year is required", { min: 2000, int: true }),
});

export const runIdParams = z.object({ runId: idField() });
export const adjustmentParams = z.object({ runId: idField(), adjustmentId: idField() });

const template = z.object({
  basicPct: z.coerce.number().min(20, "Basic is usually 40–60%").max(100),
  hraPctOfBasic: z.coerce.number().min(0).max(100),
  conveyance: z.coerce.number().min(0).max(100000),
  medical: z.coerce.number().min(0).max(100000),
});

export const payrollSettingsSchema = z.object({
  pfEnabled: z.boolean(),
  esiEnabled: z.boolean(),
  ptEnabled: z.boolean(),
  tdsEnabled: z.boolean(),
  pfCeiling: z.boolean().optional(),
  ctcTemplate: template.optional(),
});

export const adjustmentSchema = z.object({
  employeeId: idField("Pick an employee"),
  category: z.enum(PAYROLL_ADJUSTMENT_CATEGORIES, { errorMap: () => ({ message: "Pick a type" }) }),
  label: z.string().trim().min(2, "Describe it").max(120),
  amount: z.coerce.number().positive("Amount must be more than 0").max(10_000_000),
});

export const lopSchema = z.object({
  employeeId: idField("Pick an employee"),
  lopDays: z.coerce.number().min(0).max(31).multipleOf(0.5, "Use whole or half days").nullable(),
  note: text(200),
});

export const loanSchema = z.object({
  employeeId: idField("Pick an employee"),
  kind: z.enum(["loan", "salary_advance"]),
  principal: z.coerce.number().positive("Amount must be more than 0").max(10_000_000),
  emi: z.coerce.number().positive("EMI must be more than 0").max(10_000_000),
  startMonth: month,
  reason: text(300),
});

export const loanUpdateSchema = z
  .object({
    emi: z.coerce.number().positive().max(10_000_000).optional(),
    startMonth: month.optional(),
    status: z.enum(["closed", "cancelled"]).optional(),
  })
  .refine((v) => v.emi !== undefined || v.startMonth || v.status, "Nothing to change");

export const loanListQuery = z.object({ status: z.enum(["active", "closed", "cancelled", "all"]).default("active") });

export const EXPORT_TYPES = ["register", "bank", "pf_ecr", "esi", "pt", "tds"] as const;
export const exportQuery = z.object({ type: z.enum(EXPORT_TYPES) });

export type PayrollSettingsInput = z.infer<typeof payrollSettingsSchema>;
export type SalaryStructureInput = z.infer<typeof salaryStructureSchema>;
export type RunPayrollInput = z.infer<typeof runPayrollSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type LopInput = z.infer<typeof lopSchema>;
export type LoanInput = z.infer<typeof loanSchema>;
export type LoanUpdateInput = z.infer<typeof loanUpdateSchema>;
