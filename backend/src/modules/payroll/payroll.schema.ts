import { z } from "zod";
import { idField, numberField, optionalIsoDate, optionalNumber } from "../../utils/zod.js";

export const salaryStructureSchema = z.object({
  employeeId: idField("Valid employeeId is required"),
  basic: numberField("Basic must be a positive number", { min: 0 }),
  hra: optionalNumber("HRA must be a positive number", { min: 0 }),
  allowances: optionalNumber("Allowances must be a positive number", { min: 0 }),
  effectiveFrom: optionalIsoDate("Invalid effective date"),
});

export const runPayrollSchema = z.object({
  month: numberField("Month must be 1-12", { min: 1, max: 12, int: true }),
  year: numberField("Valid year is required", { min: 2000, int: true }),
});

export const runIdParams = z.object({ runId: idField() });

export type SalaryStructureInput = z.infer<typeof salaryStructureSchema>;
export type RunPayrollInput = z.infer<typeof runPayrollSchema>;
