import { create } from "zustand";
import { run } from "@/lib/api/run";
import { departmentsService, type DepartmentPayload } from "@/lib/services/departments";
import type { Department, Id } from "@/lib/types";

interface DepartmentsState {
  list: Department[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (id: Id | null, payload: DepartmentPayload) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

const byName = (a: Department, b: Department) => a.name.localeCompare(b.name);
let loading: Promise<void> | null = null; // one request at a time

export const useDepartmentsStore = create<DepartmentsState>((set, get) => ({
  list: [],
  loaded: false,

  load() {
    loading ??= run(departmentsService.list)
      .then((result) => {
        if (result.ok) set({ list: result.data, loaded: true });
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  async save(id, payload) {
    const result = await run(() => (id ? departmentsService.update(id, payload) : departmentsService.create(payload)), {
      success: id ? "Department updated" : "Department added",
    });
    if (!result.ok) return false;
    set({ list: [...get().list.filter((d) => d.id !== result.data.id), result.data].sort(byName) });
    return true;
  },

  async remove(id) {
    const result = await run(() => departmentsService.remove(id), { success: "Department removed" });
    if (result.ok) set({ list: get().list.filter((d) => d.id !== id) });
  },
}));
