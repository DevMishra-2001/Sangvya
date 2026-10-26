import { create } from "zustand";
import { run } from "@/lib/api/run";
import { designationsService } from "@/lib/services/designations";
import type { Designation, Id } from "@/lib/types";

interface DesignationsState {
  list: Designation[]; // highest level first
  loaded: boolean;
  load: () => Promise<void>;
  update: (id: Id, changes: { name: string; isActive: boolean }) => Promise<boolean>;
}

export const useDesignationsStore = create<DesignationsState>((set, get) => ({
  list: [],
  loaded: false,

  async load() {
    const result = await run(designationsService.list);
    if (result.ok) set({ list: result.data, loaded: true });
  },

  async update(id, changes) {
    const result = await run(() => designationsService.update(id, changes), { success: "Designation updated" });
    if (result.ok) set({ list: get().list.map((d) => (d.id === id ? { ...d, name: result.data.name, is_active: result.data.is_active } : d)) });
    return result.ok;
  },
}));
