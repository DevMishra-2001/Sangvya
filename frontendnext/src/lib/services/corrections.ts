import { api } from "@/lib/api/client";
import type { AttendanceCorrection, Id } from "@/lib/types";

// What the company allows (Attendance Settings)
export interface CorrectionRules {
  enabled: boolean;
  daysBack: number;
  perMonth: number | null;
}

// Attendance corrections: mine (/me) and the ones I decide (/attendance)
export const correctionsService = {
  mine: async () => (await api.get<{ corrections: AttendanceCorrection[]; rules?: CorrectionRules }>("/me/corrections")).data,
  request: async (input: { date: string; punchIn: string; punchOut: string; reason: string }) =>
    (await api.post<{ correction: AttendanceCorrection }>("/me/corrections", input)).data.correction,
  withdraw: async (id: Id) => {
    await api.delete(`/me/corrections/${id}`);
  },
  toReview: async (status: "pending" | "all" = "pending") =>
    (await api.get<{ corrections: AttendanceCorrection[] }>("/attendance/corrections", { params: { status } })).data.corrections,
  decide: async (id: Id, status: "approved" | "rejected", note?: string) =>
    (await api.patch<{ correction: AttendanceCorrection }>(`/attendance/corrections/${id}`, { status, note })).data.correction,
};
