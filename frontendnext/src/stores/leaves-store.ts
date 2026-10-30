import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { LeavePayload } from "@/lib/schemas/leave";
import { leavesService } from "@/lib/services/leaves";
import type { Id, Leave } from "@/lib/types";

interface LeavesState {
  list: Leave[];
  load: () => Promise<void>;
  apply: (payload: LeavePayload) => Promise<boolean>;
  decide: (id: Id, status: "approved" | "rejected", note?: string) => Promise<void>;
  cancel: (id: Id, mine: boolean) => Promise<void>;
}

export const useLeavesStore = create<LeavesState>((set, get) => ({
  list: [],

  async load() {
    const result = await run(leavesService.list);
    if (result.ok) set({ list: result.data });
  },

  async apply(payload) {
    const result = await run(() => leavesService.apply(payload), {
      success: payload.leaveType === "comp_off" ? "Comp off request submitted" : "Leave request submitted",
    });
    if (result.ok) set({ list: [result.data, ...get().list] });
    return result.ok;
  },

  async decide(id, status, note) {
    const result = await run(() => leavesService.decide(id, status, note), { success: status === "approved" ? "Leave approved" : "Leave rejected" });
    if (result.ok) set({ list: get().list.map((l) => (l.id === id ? result.data : l)) });
  },

  async cancel(id, mine) {
    const result = await run(() => leavesService.cancel(id), { success: mine ? "Leave withdrawn — the days are back in your balance" : "Leave cancelled" });
    if (result.ok) set({ list: get().list.map((l) => (l.id === id ? result.data : l)) });
  },
}));
