import { api } from "@/lib/api/client";
import type { Id, PayrollRun, Payslip, SalaryStructure } from "@/lib/types";
import type { SalaryStructurePayload } from "@/lib/schemas/payroll";

export const payrollService = {
  structures: async () => (await api.get<{ structures: SalaryStructure[] }>("/payroll/salary-structure")).data.structures,
  setStructure: async (payload: SalaryStructurePayload) =>
    (await api.post<{ structure: SalaryStructure }>("/payroll/salary-structure", payload)).data.structure,
  run: async (month: number, year: number) => (await api.post<{ run: PayrollRun; payslips: Payslip[] }>("/payroll/run", { month, year })).data,
  runs: async () => (await api.get<{ runs: PayrollRun[] }>("/payroll/runs")).data.runs,
  payslips: async (runId: Id) => (await api.get<{ payslips: Payslip[] }>(`/payroll/runs/${runId}/payslips`)).data.payslips,
  // Downloaded as a blob so the request goes through the same client (cookies, refresh)
  downloadPayslip: async (id: Id) => {
    const response = await api.get<Blob>(`/payroll/payslips/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "payslip.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
