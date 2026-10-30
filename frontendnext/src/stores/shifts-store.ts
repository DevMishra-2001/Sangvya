import { create } from "zustand";
import { run } from "@/lib/api/run";
import { shiftsService, type ShiftPayload } from "@/lib/services/shifts";
import type { Id, Shift } from "@/lib/types";

interface ShiftsState {
  list: Shift[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (id: Id | null, payload: ShiftPayload) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

let loading: Promise<void> | null = null; // one request at a time

export const useShiftsStore = create<ShiftsState>((set) => ({
  list: [],
  loaded: false,

  load() {
    loading ??= run(shiftsService.list)
      .then((result) => {
        if (result.ok) set({ list: result.data, loaded: true });
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  async save(id, payload) {
    const result = await run(() => (id ? shiftsService.update(id, payload) : shiftsService.create(payload)), { success: id ? "Shift updated" : "Shift added" });
    if (!result.ok) return false;
    // Making one the default changes the others too — reload the list
    loading = null;
    const fresh = await run(shiftsService.list, { silent: true });
    if (fresh.ok) set({ list: fresh.data, loaded: true });
    return true;
  },

  async remove(id) {
    const result = await run(() => shiftsService.remove(id), { success: "Shift removed — its employees now follow the default shift" });
    if (result.ok) {
      const fresh = await run(shiftsService.list, { silent: true });
      if (fresh.ok) set({ list: fresh.data });
    }
  },
}));
