// Team attendance (HR / managers marking by date)
import { create } from "zustand";
import { run } from "@/lib/api/run";
import { attendanceService } from "@/lib/services/attendance";
import type { AttendanceRow, AttendanceStatus, Id, ISODate } from "@/lib/types";

interface AttendanceState {
  byDate: Record<ISODate, AttendanceRow[]>;
  load: (date: ISODate) => Promise<void>;
  mark: (employeeId: Id, date: ISODate, status: AttendanceStatus) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  byDate: {},

  async load(date) {
    const result = await run(() => attendanceService.byDate(date));
    if (result.ok) set({ byDate: { ...get().byDate, [date]: result.data } });
  },

  async mark(employeeId, date, status) {
    const result = await run(() => attendanceService.mark(employeeId, date, status), { success: "Attendance marked" });
    if (!result.ok) return;
    const rows = (get().byDate[date] ?? []).filter((r) => r.employee_id !== employeeId);
    set({ byDate: { ...get().byDate, [date]: [...rows, result.data] } });
  },
}));
