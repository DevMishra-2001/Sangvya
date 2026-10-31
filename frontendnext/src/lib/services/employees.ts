import { api } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type { DocumentCategory, Employee, EmployeeDocument, EmployeeImportCheck, EmployeeImportResult, EmployeePrivate, ExitReason, Id, OnboardingLinkStatus } from "@/lib/types";
import type { EmployeePayload } from "@/lib/schemas/employee";

export const employeesService = {
  list: async () => (await api.get<{ employees: Employee[] }>("/employees")).data.employees,
  create: async (payload: EmployeePayload) => (await api.post<{ employee: Employee }>("/employees", payload)).data.employee,
  update: async (id: Id, payload: EmployeePayload) => (await api.put<{ employee: Employee }>(`/employees/${id}`, payload)).data.employee,
  remove: async (id: Id) => {
    await api.delete(`/employees/${id}`);
  },
  get: async (id: Id) => (await api.get<{ employee: Employee }>(`/employees/${id}`)).data.employee,
  // Leaving: notice (future last day) or exited; cancel a notice; rehire someone who left
  startExit: async (id: Id, input: { lastWorkingDay: string; reason: ExitReason; notes?: string }) =>
    (await api.post<{ employee: Employee }>(`/employees/${id}/exit`, input)).data.employee,
  cancelExit: async (id: Id) => (await api.post<{ employee: Employee }>(`/employees/${id}/cancel-exit`)).data.employee,
  rehire: async (id: Id) => (await api.post<{ employee: Employee }>(`/employees/${id}/rehire`)).data.employee,
  // Documents (HR / Admin)
  documents: async (id: Id) => (await api.get<{ documents: EmployeeDocument[] }>(`/employees/${id}/documents`)).data.documents,
  uploadDocument: async (id: Id, file: File, meta: { name: string; category: DocumentCategory }, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append("name", meta.name);
    form.append("category", meta.category);
    form.append("file", file, file.name);
    const { data } = await api.post<{ document: EmployeeDocument }>(`/employees/${id}/documents`, form, {
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    });
    return data.document;
  },
  // A signed link that works for a few minutes
  documentLink: async (id: Id, docId: Id) => (await api.get<{ url: string; fileName: string }>(`/employees/${id}/documents/${docId}/link`)).data,
  removeDocument: async (id: Id, docId: Id) => {
    await api.delete(`/employees/${id}/documents/${docId}`);
  },
  // Next free employee code in the company's format
  nextCode: async () => (await api.get<{ code: string; prefix: string; format: string }>("/employees/next-code")).data.code,
  timeline: async (id: Id) => (await api.get<{ events: { id: Id; action: string; summary: string; actor: string | null; created_at: string }[] }>(`/employees/${id}/timeline`)).data.events,
  // Statutory IDs + bank (HR / Admin)
  private: async (id: Id) => (await api.get<{ private: EmployeePrivate | null }>(`/employees/${id}/private`)).data.private,
  ifsc: async (code: string) => (await api.get<{ bank: string | null; branch: string | null; city: string | null; state: string | null }>(`/employees/ifsc/${code}`)).data,
  // Self-onboarding link
  onboardingLink: async (id: Id) => (await api.get<{ link: OnboardingLinkStatus | null }>(`/employees/${id}/onboarding-link`)).data.link,
  createOnboardingLink: async (id: Id, body: { hours: number; sendEmail: boolean }) =>
    (await api.post<{ url: string; expiresAt: string; emailedTo: string | null }>(`/employees/${id}/onboarding-link`, body)).data,
  revokeOnboardingLink: async (id: Id) => {
    await api.delete(`/employees/${id}/onboarding-link`);
  },
  // Import from CSV / Excel: template → check (preview) → import
  importTemplate: (format: "xlsx" | "csv") => downloadFile("/employees/import/template", { format }, `employee-import-template.${format}`),
  checkImport: async (file: File) => (await api.post<EmployeeImportCheck>("/employees/import/check", fileForm(file))).data,
  runImport: async (file: File) => (await api.post<EmployeeImportResult>("/employees/import", fileForm(file))).data,
};

function fileForm(file: File) {
  const form = new FormData();
  form.append("file", file, file.name);
  return form;
}
