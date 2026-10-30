import { api } from "@/lib/api/client";
import type { Department, Id } from "@/lib/types";

export interface DepartmentPayload {
  name: string;
  code: string | null;
  headId: Id | null;
  isActive: boolean;
}

// The company's departments
export const departmentsService = {
  list: async () => (await api.get<{ departments: Department[] }>("/departments")).data.departments,
  create: async (input: DepartmentPayload) => (await api.post<{ department: Department }>("/departments", input)).data.department,
  update: async (id: Id, input: DepartmentPayload) => (await api.put<{ department: Department }>(`/departments/${id}`, input)).data.department,
  remove: async (id: Id) => {
    await api.delete(`/departments/${id}`);
  },
};
