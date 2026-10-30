import { api } from "@/lib/api/client";
import type { AttendanceDay, AttendanceDayResponse, Balances, CalendarResponse, ISODate, MyLeavesResponse, MyTeam, TodayResponse } from "@/lib/types";

export type PunchAction = "punch-in" | "punch-out" | "break-start" | "break-end";

export interface PunchDetails {
  location?: string; // work mode: office, client_site, remote, office_client, other
  remarks?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number; // metres
  photoUrl?: string; // selfie uploaded via /api/upload
}

// The logged-in employee's own attendance (/api/me)
export const selfService = {
  // People who report to me, with today's attendance
  team: async () => (await api.get<MyTeam>("/me/team")).data,
  today: async () => (await api.get<TodayResponse>("/me/today")).data,
  punch: async (action: PunchAction, details: PunchDetails = {}) =>
    (await api.post<{ day: AttendanceDay }>(`/me/${action}`, details)).data.day,
  calendar: async (month: string) => (await api.get<CalendarResponse>("/me/calendar", { params: { month } })).data,
  attendanceDay: async (date: ISODate) => (await api.get<AttendanceDayResponse>("/me/attendance", { params: { date } })).data,
  leaves: async (month: string) => (await api.get<MyLeavesResponse>("/me/leaves", { params: { month } })).data,
  leaveBalance: async () => (await api.get<{ balances: Balances }>("/me/leave-balance")).data.balances,
};
