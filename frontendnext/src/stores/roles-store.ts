import { create } from "zustand";
import { run } from "@/lib/api/run";
import { rolesService } from "@/lib/services/roles";
import type { Id, Role } from "@/lib/types";

interface RolesState {
  list: Role[]; // highest level first
  loaded: boolean;
  load: () => Promise<void>;
  update: (id: Id, changes: { name: string; isActive: boolean }) => Promise<boolean>;
}

export const useRolesStore = create<RolesState>((set, get) => ({
  list: [],
  loaded: false,

  async load() {
    const result = await run(rolesService.list);
    if (result.ok) set({ list: result.data, loaded: true });
  },

  async update(id, changes) {
    const result = await run(() => rolesService.update(id, changes), { success: "Role updated" });
    if (result.ok) set({ list: get().list.map((r) => (r.id === id ? { ...r, name: result.data.name, is_active: result.data.is_active } : r)) });
    return result.ok;
  },
}));
