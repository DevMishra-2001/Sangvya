import { api } from "@/lib/api/client";
import type { Id } from "@/lib/types";

export type ProbationStatus = "on_probation" | "extended" | "confirmed" | "not_confirmed";
export const PROBATION_STATUS_LABELS: Record<ProbationStatus, string> = { on_probation: "On probation", extended: "Extended", confirmed: "Confirmed", not_confirmed: "Not confirmed" };

export interface ProbationPerson {
  id: Id;
  name: string;
  photo_url: string | null;
  employee_code: string | null;
  designation: string | null;
  department: string | null;
  manager_name: string | null;
  join_date: string;
  probation_end_date: string | null;
  probation_status: ProbationStatus | null;
  confirmed_on: string | null;
  status: "active" | "notice" | "exited";
  extensions: number;
}

export interface ProbationEvent {
  id: Id;
  action: "started" | "extended" | "confirmed" | "not_confirmed" | "note";
  old_end: string | null;
  new_end: string | null;
  notes: string | null;
  by: string | null;
  created_at: string;
}

export const probationService = {
  list: async (params: { page: number; limit: number; tab: string; search?: string }) =>
    (await api.get<{ people: ProbationPerson[]; stats: { active: number; due: number; overdue: number; confirmed: number; extended: number }; today: string; page: number; limit: number; total: number }>("/probation", { params })).data,
  start: async (body: { employeeId: number; endDate: string; notes?: string }) => {
    await api.post("/probation", body);
  },
  confirm: async (id: Id, body: { confirmedOn: string; notes?: string }) => {
    await api.post(`/probation/${id}/confirm`, body);
  },
  extend: async (id: Id, body: { newEnd: string; notes: string }) => {
    await api.post(`/probation/${id}/extend`, body);
  },
  notConfirm: async (id: Id, body: { notes: string; lastWorkingDay?: string }) => {
    await api.post(`/probation/${id}/not-confirmed`, body);
  },
  note: async (id: Id, notes: string) => {
    await api.post(`/probation/${id}/notes`, { notes });
  },
  history: async (id: Id) => (await api.get<{ history: ProbationEvent[] }>(`/probation/${id}/history`)).data.history,
};
