import { api } from "@/lib/api/client";
import type { Employee, Id } from "@/lib/types";
import type { EmployeePayload } from "@/lib/schemas/employee";

export const employeesService = {
  list: async () => (await api.get<{ employees: Employee[] }>("/employees")).data.employees,
  create: async (payload: EmployeePayload) => (await api.post<{ employee: Employee }>("/employees", payload)).data.employee,
  update: async (id: Id, payload: EmployeePayload) => (await api.put<{ employee: Employee }>(`/employees/${id}`, payload)).data.employee,
  remove: async (id: Id) => {
    await api.delete(`/employees/${id}`);
  },
};
