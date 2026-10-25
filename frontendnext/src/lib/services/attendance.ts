import { api } from "@/lib/api/client";
import type { AttendanceRow, AttendanceStatus, Id, ISODate } from "@/lib/types";

export const attendanceService = {
  byDate: async (date: ISODate) => (await api.get<{ attendance: AttendanceRow[] }>("/attendance", { params: { date } })).data.attendance,
  mark: async (employeeId: Id, date: ISODate, status: AttendanceStatus) =>
    (await api.post<{ attendance: AttendanceRow }>("/attendance", { employeeId, date, status })).data.attendance,
};
