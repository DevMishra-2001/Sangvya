import { create } from "zustand";
import { run } from "@/lib/api/run";
import { designationsService } from "@/lib/services/designations";
import type { Designation, Id } from "@/lib/types";

interface DesignationsState {
  list: Designation[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (name: string, isActive: boolean) => Promise<boolean>;
  update: (id: Id, changes: { name: string; isActive: boolean }) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

const byName = (a: Designation, b: Designation) => a.name.localeCompare(b.name);

export const useDesignationsStore = create<DesignationsState>((set, get) => ({
  list: [],
  loaded: false,

  async load() {
    const result = await run(designationsService.list);
    if (result.ok) set({ list: result.data, loaded: true });
  },

  async add(name, isActive) {
    const result = await run(() => designationsService.create({ name, isActive }), { success: "Designation added" });
    if (result.ok) set({ list: [...get().list, result.data].sort(byName) });
    return result.ok;
  },

  async update(id, changes) {
    const result = await run(() => designationsService.update(id, changes), { success: "Designation updated" });
    if (result.ok) set({ list: get().list.map((d) => (d.id === id ? { ...d, ...result.data, employee_count: d.employee_count } : d)).sort(byName) });
    return result.ok;
  },

  async remove(id) {
    const result = await run(() => designationsService.remove(id), { success: "Designation removed" });
    if (result.ok) set({ list: get().list.filter((d) => d.id !== id) });
  },
}));
