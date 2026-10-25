import { create } from "zustand";
import { run } from "@/lib/api/run";
import { designationsService } from "@/lib/services/designations";
import type { Designation, Id } from "@/lib/types";

interface DesignationsState {
  list: Designation[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (name: string) => Promise<boolean>;
  rename: (id: Id, name: string) => Promise<boolean>;
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

  async add(name) {
    const result = await run(() => designationsService.create(name), { success: "Designation added" });
    if (result.ok) set({ list: [...get().list, result.data].sort(byName) });
    return result.ok;
  },

  async rename(id, name) {
    const result = await run(() => designationsService.rename(id, name), { success: "Designation renamed" });
    if (result.ok) set({ list: get().list.map((d) => (d.id === id ? { ...d, name: result.data.name } : d)).sort(byName) });
    return result.ok;
  },

  async remove(id) {
    const result = await run(() => designationsService.remove(id), { success: "Designation removed" });
    if (result.ok) set({ list: get().list.filter((d) => d.id !== id) });
  },
}));
