import { api } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type { EmployeeLoan, Id, LopOverride, MyPayslip, PayrollAdjustment, PayrollItemCategory, PayrollRun, PayrollRunTotals, PayrollSettings, Payslip, SalaryStructure } from "@/lib/types";

type RunItems = { run: PayrollRun; adjustments: PayrollAdjustment[]; lopOverrides: LopOverride[] };
export type PayrollExport = "register" | "bank" | "pf_ecr" | "esi" | "pt" | "tds";
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
  history: async (employeeId: Id) => (await api.get<{ history: SalaryStructure[] }>(`/payroll/salary-structure/${employeeId}/history`)).data.history,
  summary: async (runId: Id) => (await api.get<{ run: PayrollRun; totals: PayrollRunTotals }>(`/payroll/runs/${runId}/summary`)).data,
  items: async (runId: Id) => (await api.get<{ adjustments: PayrollAdjustment[]; lopOverrides: LopOverride[] }>(`/payroll/runs/${runId}/adjustments`)).data,
  addItem: async (runId: Id, body: { employeeId: number; category: PayrollItemCategory; label: string; amount: number }) => (await api.post<RunItems>(`/payroll/runs/${runId}/adjustments`, body)).data,
  removeItem: async (runId: Id, id: Id) => (await api.delete<RunItems>(`/payroll/runs/${runId}/adjustments/${id}`)).data,
  setLop: async (runId: Id, body: { employeeId: number; lopDays: number | null; note?: string }) => (await api.put<RunItems>(`/payroll/runs/${runId}/lop`, body)).data,
  exportRun: (runId: Id, type: PayrollExport) => downloadFile(`/payroll/runs/${runId}/export`, { type }, `${type}.xlsx`),
  loans: async (status: string) => (await api.get<{ loans: EmployeeLoan[]; totals: { active: number; outstanding: string; monthlyEmi: string } }>("/payroll/loans", { params: { status } })).data,
  createLoan: async (body: { employeeId: number; kind: "loan" | "salary_advance"; principal: number; emi: number; startMonth: string; reason?: string }) => (await api.post<{ loan: EmployeeLoan }>("/payroll/loans", body)).data.loan,
  updateLoan: async (id: Id, body: { emi?: number; startMonth?: string; status?: "closed" | "cancelled" }) => (await api.patch(`/payroll/loans/${id}`, body)).data,
  recoveries: async (id: Id) => (await api.get<{ recoveries: { id: Id; amount: string; month: number; year: number }[] }>(`/payroll/loans/${id}/recoveries`)).data.recoveries,
  // An employee's own (finalized) payslips
  mine: async () => (await api.get<{ payslips: MyPayslip[] }>("/me/payslips")).data.payslips,
  downloadMine: (id: Id) => downloadFile(`/me/payslips/${id}/pdf`, undefined, "payslip.pdf"),
};
