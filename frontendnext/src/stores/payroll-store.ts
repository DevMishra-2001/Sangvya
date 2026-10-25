import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { SalaryStructurePayload } from "@/lib/schemas/payroll";
import { payrollService } from "@/lib/services/payroll";
import type { Id, PayrollRun, Payslip, SalaryStructure } from "@/lib/types";

interface PayrollState {
  structures: SalaryStructure[];
  runs: PayrollRun[];
  payslipsByRun: Record<Id, Payslip[]>;
  running: boolean;
  loadStructures: () => Promise<void>;
  loadRuns: () => Promise<void>;
  loadPayslips: (runId: Id) => Promise<void>;
  setStructure: (payload: SalaryStructurePayload) => Promise<boolean>;
  runPayroll: (month: number, year: number) => Promise<Id | null>;
  download: (payslipId: Id) => Promise<void>;
}

export const usePayrollStore = create<PayrollState>((set, get) => ({
  structures: [],
  runs: [],
  payslipsByRun: {},
  running: false,

  async loadStructures() {
    const result = await run(payrollService.structures);
    if (result.ok) set({ structures: result.data });
  },

  async loadRuns() {
    const result = await run(payrollService.runs);
    if (result.ok) set({ runs: result.data });
  },

  async loadPayslips(runId) {
    const result = await run(() => payrollService.payslips(runId));
    if (result.ok) set({ payslipsByRun: { ...get().payslipsByRun, [runId]: result.data } });
  },

  async setStructure(payload) {
    const result = await run(() => payrollService.setStructure(payload), { success: "Salary structure saved" });
    if (result.ok) await get().loadStructures();
    return result.ok;
  },

  async runPayroll(month, year) {
    set({ running: true });
    const result = await run(() => payrollService.run(month, year), { success: "Payroll run completed", error: "Payroll run failed" });
    set({ running: false });
    if (!result.ok) return null;
    await get().loadRuns();
    await get().loadPayslips(result.data.run.id);
    return result.data.run.id;
  },

  async download(payslipId) {
    await run(() => payrollService.downloadPayslip(payslipId), { error: "Could not download the payslip" });
  },
}));
