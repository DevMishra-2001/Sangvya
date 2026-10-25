import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { HolidayInput } from "@/lib/schemas/holiday";
import { holidaysService } from "@/lib/services/holidays";
import type { Holiday, Id } from "@/lib/types";

interface HolidaysState {
  list: Holiday[];
  load: () => Promise<void>;
  add: (input: HolidayInput) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

const byDate = (a: Holiday, b: Holiday) => a.date.localeCompare(b.date);

export const useHolidaysStore = create<HolidaysState>((set, get) => ({
  list: [],

  async load() {
    const result = await run(holidaysService.list);
    if (result.ok) set({ list: result.data });
  },

  async add(input) {
    const result = await run(() => holidaysService.create(input), { success: "Holiday added" });
    if (result.ok) set({ list: [...get().list, result.data].sort(byDate) });
    return result.ok;
  },

  async remove(id) {
    const result = await run(() => holidaysService.remove(id), { success: "Holiday removed" });
    if (result.ok) set({ list: get().list.filter((h) => h.id !== id) });
  },
}));
