import { api } from "@/lib/api/client";
import type { ExitReason, Id } from "@/lib/types";

export type ExitStage = "notice" | "clearance" | "settlement" | "completed";
export const EXIT_STAGE_LABELS: Record<ExitStage, string> = { notice: "Serving notice", clearance: "Clearance", settlement: "Full & final", completed: "Completed" };

export interface ExitRow {
  id: Id;
  name: string;
  photo_url: string | null;
  employee_code: string | null;
  designation: string | null;
  department: string | null;
  join_date: string | null;
  status: "notice" | "exited";
  exit_date: string | null;
  exit_reason: ExitReason | null;
  exit_notes: string | null;
  salary: string | null;
  started_on: string | null;
  stage: ExitStage;
  open_assets: number;
  pending_items: number;
  total_items: number;
  settlement_status: "pending" | "approved" | "paid" | null;
  net_payable: string;
}

export interface ExitDetail {
  exit: ExitRow;
  record: {
    interview_notes: string | null;
    interview_rating: number | null;
    would_rejoin: boolean | null;
    last_salary: string | null;
    leave_encashment: string | null;
    bonus: string | null;
    notice_recovery: string | null;
    other_deductions: string | null;
    settlement_notes: string | null;
    settlement_status: "pending" | "approved" | "paid";
    settled_on: string | null;
    completed_at: string | null;
  };
  clearance: { key: string; label: string; done: boolean; done_at: string | null; notes: string | null; by: string | null }[];
  openAssets: { id: Id; asset_code: string; name: string; assigned_on: string }[];
}

export const exitsService = {
  list: async (params: { page: number; limit: number; stage: string; search?: string }) =>
    (await api.get<{ exits: ExitRow[]; stats: { notice: number; clearance: number; settlement: number; completedThisMonth: number; avgNoticeDays: number }; page: number; limit: number; total: number }>("/exits", { params })).data,
  detail: async (id: Id) => (await api.get<ExitDetail>(`/exits/${id}`)).data,
  clearance: async (id: Id, key: string, body: { done: boolean; notes?: string | null }) => (await api.put<ExitDetail>(`/exits/${id}/clearance/${key}`, body)).data,
  settlement: async (id: Id, body: Record<string, unknown>) => (await api.put<ExitDetail>(`/exits/${id}/settlement`, body)).data,
  interview: async (id: Id, body: { notes: string | null; rating: number | null; wouldRejoin: boolean | null }) => (await api.put<ExitDetail>(`/exits/${id}/interview`, body)).data,
  complete: async (id: Id) => (await api.post<ExitDetail>(`/exits/${id}/complete`)).data,
};
