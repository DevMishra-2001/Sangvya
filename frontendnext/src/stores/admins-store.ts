import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { AdminInput } from "@/lib/schemas/admin";
import { adminsService } from "@/lib/services/admins";
import type { AdminRow, Id } from "@/lib/types";

interface AdminsState {
  list: AdminRow[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (input: AdminInput) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

export const useAdminsStore = create<AdminsState>((set, get) => ({
  list: [],
  loaded: false,

  async load() {
    const result = await run(adminsService.list);
    if (result.ok) set({ list: result.data, loaded: true });
  },

  async add(input) {
    const result = await run(() => adminsService.create(input), { success: (a) => `Login created for ${a.name}` });
    if (result.ok) set({ list: [...get().list, result.data] });
    return result.ok;
  },

  async remove(id) {
    const result = await run(() => adminsService.remove(id), { success: "Admin removed" });
    if (result.ok) set({ list: get().list.filter((a) => a.id !== id) });
  },
}));
