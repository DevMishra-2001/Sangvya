import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { EmployeePayload } from "@/lib/schemas/employee";
import { employeesService } from "@/lib/services/employees";
import type { Employee, Id } from "@/lib/types";

interface EmployeesState {
  list: Employee[];
  loading: boolean;
  load: () => Promise<void>;
  add: (payload: EmployeePayload) => Promise<boolean>;
  update: (id: Id, payload: EmployeePayload) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
  // Put a fresh copy of one employee in the list (profile page actions)
  upsert: (employee: Employee) => void;
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  list: [],
  loading: false,

  async load() {
    set({ loading: true });
    const result = await run(employeesService.list);
    set({ loading: false, ...(result.ok ? { list: result.data } : {}) });
  },

  async add(payload) {
    const result = await run(() => employeesService.create(payload), { success: "Employee added" });
    if (result.ok) set({ list: [result.data, ...get().list] });
    return result.ok;
  },

  async update(id, payload) {
    const result = await run(() => employeesService.update(id, payload), { success: "Employee updated" });
    if (result.ok) set({ list: get().list.map((e) => (e.id === id ? result.data : e)) });
    return result.ok;
  },

  upsert(employee) {
    const list = get().list;
    set({ list: list.some((e) => e.id === employee.id) ? list.map((e) => (e.id === employee.id ? employee : e)) : [employee, ...list] });
  },

  async remove(id) {
    const result = await run(() => employeesService.remove(id), { success: "Employee removed" });
    if (result.ok) set({ list: get().list.filter((e) => e.id !== id) });
  },
}));
