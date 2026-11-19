import { z } from "zod";
import { optionalDate, optionalNumber, requiredNumber } from "./common";

export const salaryStructureSchema = z.object({
  basic: requiredNumber("Basic must be a positive number", { min: 0 }),
  hra: optionalNumber("HRA must be a positive number", { min: 0 }),
  allowances: optionalNumber("Allowances must be a positive number", { min: 0 }),
  effectiveFrom: optionalDate,
});

export const runPayrollSchema = z.object({
  month: requiredNumber("Choose a month", { min: 1, max: 12 }),
  year: requiredNumber("Enter a valid year", { min: 2000, max: 2100 }),
});

export type SalaryStructureForm = z.input<typeof salaryStructureSchema>;
export interface SalaryStructurePayload {
  employeeId: number;
  basic: number;
  hra: number;
  components: { label: string; amount: number }[];
  ctcAnnual: number | null;
  effectiveFrom?: string;
  note?: string;
}
export type RunPayrollForm = z.input<typeof runPayrollSchema>;
