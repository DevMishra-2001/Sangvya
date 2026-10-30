import { api } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type { Id, MyPayslip, PayrollRun, PayrollSettings, Payslip, SalaryStructure } from "@/lib/types";
import type { SalaryStructurePayload } from "@/lib/schemas/payroll";

export const payrollService = {
  structures: async () => (await api.get<{ structures: SalaryStructure[] }>("/payroll/salary-structure")).data.structures,
  setStructure: async (payload: SalaryStructurePayload) =>
    (await api.post<{ structure: SalaryStructure }>("/payroll/salary-structure", payload)).data.structure,
  settings: async () => (await api.get<{ settings: PayrollSettings }>("/payroll/settings")).data.settings,
  saveSettings: async (input: PayrollSettings) => (await api.put<{ settings: PayrollSettings }>("/payroll/settings", input)).data.settings,
  run: async (month: number, year: number) => (await api.post<{ run: PayrollRun }>("/payroll/run", { month, year })).data.run,
  recalculate: async (id: Id) => (await api.post<{ run: PayrollRun }>(`/payroll/runs/${id}/recalculate`)).data.run,
  finalize: async (id: Id) => (await api.post<{ run: PayrollRun }>(`/payroll/runs/${id}/finalize`)).data.run,
  deleteRun: async (id: Id) => {
    await api.delete(`/payroll/runs/${id}`);
  },
  runs: async () => (await api.get<{ runs: PayrollRun[] }>("/payroll/runs")).data.runs,
  payslips: async (runId: Id) => (await api.get<{ payslips: Payslip[] }>(`/payroll/runs/${runId}/payslips`)).data.payslips,
  downloadPayslip: (id: Id) => downloadFile(`/payroll/payslips/${id}/pdf`, undefined, "payslip.pdf"),
  // An employee's own (finalized) payslips
  mine: async () => (await api.get<{ payslips: MyPayslip[] }>("/me/payslips")).data.payslips,
  downloadMine: (id: Id) => downloadFile(`/me/payslips/${id}/pdf`, undefined, "payslip.pdf"),
};
