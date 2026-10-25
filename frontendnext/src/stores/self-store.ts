// The logged-in employee's own day: shared by the header timer, the dashboard
// punch card and the My Attendance page.
import { create } from "zustand";
import { run } from "@/lib/api/run";
import { selfService, type PunchAction, type PunchDetails } from "@/lib/services/self";
import type { TodayResponse } from "@/lib/types";

const PUNCH_MESSAGES: Record<PunchAction, string> = {
  "punch-in": "Checked in — have a great day!",
  "break-start": "Break started",
  "break-end": "Welcome back — break ended",
  "punch-out": "Checked out",
};

interface SelfState {
  today: TodayResponse | null;
  busy: boolean;
  loadToday: () => Promise<void>;
  punch: (action: PunchAction, details?: PunchDetails) => Promise<boolean>;
}

export const useSelfStore = create<SelfState>((set, get) => ({
  today: null,
  busy: false,

  async loadToday() {
    const result = await run(selfService.today, { silent: true });
    if (result.ok) set({ today: result.data });
  },

  async punch(action, details) {
    set({ busy: true });
    const result = await run(() => selfService.punch(action, details), { success: PUNCH_MESSAGES[action] });
    set({ busy: false });
    if (result.ok) await get().loadToday();
    return result.ok;
  },
}));
