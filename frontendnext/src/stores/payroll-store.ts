import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { SalaryStructurePayload } from "@/lib/schemas/payroll";
import { payrollService } from "@/lib/services/payroll";
import type { Id, PayrollRun, PayrollSettings, Payslip, SalaryStructure } from "@/lib/types";

interface PayrollState {
  structures: SalaryStructure[];
  runs: PayrollRun[];
  payslipsByRun: Record<Id, Payslip[]>;
  settings: PayrollSettings | null;
  busy: boolean;
  loadStructures: () => Promise<void>;
  loadRuns: () => Promise<void>;
  loadPayslips: (runId: Id) => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSettings: (input: PayrollSettings) => Promise<void>;
  setStructure: (payload: SalaryStructurePayload) => Promise<boolean>;
  runPayroll: (month: number, year: number) => Promise<Id | null>;
  recalculate: (id: Id) => Promise<void>;
  finalize: (id: Id) => Promise<void>;
  deleteRun: (id: Id) => Promise<boolean>;
  download: (payslipId: Id) => Promise<void>;
}

export const usePayrollStore = create<PayrollState>((set, get) => {
  // A run changed: refresh it in the list and reload its payslips
  const refresh = async (r: PayrollRun) => {
    set({ runs: get().runs.map((x) => (x.id === r.id ? r : x)) });
    await get().loadPayslips(r.id);
  };

  return {
    structures: [],
    runs: [],
    payslipsByRun: {},
    settings: null,
    busy: false,

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

    async loadSettings() {
      const result = await run(payrollService.settings);
      if (result.ok) set({ settings: result.data });
    },

    async saveSettings(input) {
      const prev = get().settings;
      set({ settings: input });
      const result = await run(() => payrollService.saveSettings(input), { success: "Payroll settings saved" });
      set({ settings: result.ok ? result.data : prev });
    },

    async setStructure(payload) {
      const result = await run(() => payrollService.setStructure(payload), { success: "Salary structure saved" });
      if (result.ok) await get().loadStructures();
      return result.ok;
    },

    async runPayroll(month, year) {
      set({ busy: true });
      const result = await run(() => payrollService.run(month, year), { success: "Draft payroll created — review it, then finalize" });
      set({ busy: false });
      if (!result.ok) return null;
      set({ runs: [result.data, ...get().runs].sort((a, b) => b.year - a.year || b.month - a.month) });
      await get().loadPayslips(result.data.id);
      return result.data.id;
    },

    async recalculate(id) {
      set({ busy: true });
      const result = await run(() => payrollService.recalculate(id), { success: "Payroll recalculated" });
      set({ busy: false });
      if (result.ok) await refresh(result.data);
    },

    async finalize(id) {
      set({ busy: true });
      const result = await run(() => payrollService.finalize(id), { success: "Payroll finalized — employees can now see their payslips" });
      set({ busy: false });
      if (result.ok) await refresh(result.data);
    },

    async deleteRun(id) {
      const result = await run(() => payrollService.deleteRun(id), { success: "Draft deleted" });
      if (result.ok) set({ runs: get().runs.filter((r) => r.id !== id) });
      return result.ok;
    },

    async download(payslipId) {
      await run(() => payrollService.downloadPayslip(payslipId), { error: "Could not download the payslip" });
    },
  };
});
