import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { HolidayInput } from "@/lib/schemas/holiday";
import { holidaysService } from "@/lib/services/holidays";
import type { Holiday, Id } from "@/lib/types";

interface HolidaysState {
  year: number;
  list: Holiday[];
  weeklyOffs: string[];
  loaded: boolean;
  load: (year?: number) => Promise<void>;
  save: (id: Id | null, input: HolidayInput) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

const byDate = (a: Holiday, b: Holiday) => a.date.localeCompare(b.date);

export const useHolidaysStore = create<HolidaysState>((set, get) => ({
  year: new Date().getFullYear(),
  list: [],
  weeklyOffs: [],
  loaded: false,

  async load(year = get().year) {
    set({ year });
    const result = await run(() => holidaysService.list(year));
    if (result.ok && get().year === year) set({ list: result.data.holidays, weeklyOffs: result.data.weeklyOffs, loaded: true });
  },

  async save(id, input) {
    const result = await run(() => (id ? holidaysService.update(id, input) : holidaysService.create(input)), { success: id ? "Holiday updated" : "Holiday added" });
    if (!result.ok) return false;
    const inYear = result.data.date.startsWith(String(get().year));
    const rest = get().list.filter((h) => h.id !== result.data.id);
    set({ list: (inYear ? [...rest, result.data] : rest).sort(byDate) });
    return true;
  },

  async remove(id) {
    const result = await run(() => holidaysService.remove(id), { success: "Holiday removed" });
    if (result.ok) set({ list: get().list.filter((h) => h.id !== id) });
  },
}));
