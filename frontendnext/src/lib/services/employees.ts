import { api } from "@/lib/api/client";
import type { DocumentCategory, Employee, EmployeeDocument, ExitReason, Id } from "@/lib/types";
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
};
