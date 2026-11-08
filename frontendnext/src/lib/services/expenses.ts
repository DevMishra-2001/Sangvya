import { api } from "@/lib/api/client";
import { downloadFile, openFile } from "@/lib/download";
import type { Id } from "@/lib/types";

export type AdvanceStatus = "pending" | "approved" | "on_hold" | "rejected" | "paid" | "cancelled";
export type ClaimStatus = "draft" | "submitted" | "approved" | "on_hold" | "rejected" | "paid";
export type TravelType = "cab" | "auto" | "bus" | "metro" | "train" | "flight" | "own_car" | "own_bike" | "other";
export interface Attachment {
  path: string;
  name: string;
}

export interface ExpenseBalance {
  employeeId: Id;
  month: string;
  opening: number;
  monthAdvance: number;
  monthExpense: number;
  monthPaid: number;
  lastPaid: number;
  lastPaidOn: string | null;
  closing: number;
}

export interface Advance {
  id: Id;
  employee_id: Id;
  employee_name: string;
  advance_type: "salary" | "tada";
  amount: string;
  purpose: string;
  expected_date: string | null;
  ifsc: string | null;
  account_number: string | null;
  bank_name: string | null;
  attachments: Attachment[];
  status: AdvanceStatus;
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  paid_amount: string | null;
  paid_on: string | null;
  payment_ref: string | null;
  loan_id: Id | null;
  created_at: string;
}

export interface TravelLine {
  id?: Id;
  travel_type: TravelType;
  from_place: string | null;
  to_place: string | null;
  amount: string;
  description: string | null;
}

export interface Claim {
  id: Id;
  employee_id: Id;
  employee_name: string;
  claim_date: string;
  trip_name: string;
  country: string | null;
  state: string | null;
  city: string | null;
  locality: string | null;
  client_name: string | null;
  teammates: string | null;
  expense_type: "domestic" | "international";
  hotel_amount: string;
  hotel_name: string | null;
  hotel_description: string | null;
  breakfast: string;
  lunch: string;
  dinner: string;
  meals_description: string | null;
  local_total: string;
  intercity_total: string;
  entertainment_amount: string;
  entertainment_description: string | null;
  other_amount: string;
  other_description: string | null;
  total: string;
  attachments: Attachment[];
  status: ClaimStatus;
  decision_note: string | null;
  approved_amount: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  paid_amount: string | null;
  paid_on: string | null;
  payment_ref: string | null;
  submitted_at: string | null;
}

export interface ClaimDetail {
  claim: Claim;
  localTravel: TravelLine[];
  intercityTravel: TravelLine[];
  can: { edit: boolean; decide: boolean; pay: boolean; delete: boolean };
}

export interface ExpenseRow {
  kind: "claim" | "advance";
  id: Id;
  employee_id: Id;
  employee_name: string;
  employee_code: string | null;
  department: string | null;
  title: string;
  date: string;
  hotel: number;
  meals: number;
  local: number;
  intercity: number;
  entertainment: number;
  others: number;
  total: number;
  approved: number | null;
  status: AdvanceStatus | ClaimStatus;
  files: number;
  can_decide: boolean;
  can_pay: boolean;
  can_delete: boolean;
}

export interface ExpenseFilters {
  kind?: string;
  month?: string;
  employeeId?: Id;
  departmentId?: Id;
  branchId?: Id;
  status?: string;
  scope?: string;
  page?: number;
  limit?: number;
}

type Body = Record<string, unknown>;

export const expensesService = {
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return (await api.post<{ file: Attachment }>("/expenses/files", form)).data.file;
  },
  bank: async () => (await api.get<{ bank: { ifsc: string | null; account_number: string | null; bank_name: string | null } | null }>("/expenses/bank")).data.bank,
  balance: async (params: { employeeId?: Id; month?: string } = {}) => (await api.get<{ balance: ExpenseBalance | null }>("/expenses/balance", { params })).data.balance,
  people: async () => (await api.get<{ people: { id: Id; name: string; code: string | null }[] }>("/expenses/people")).data.people,
  list: async (params: ExpenseFilters) => (await api.get<{ rows: ExpenseRow[]; total: number; page: number; limit: number; grandTotal: number; canManage: boolean }>("/expenses", { params })).data,
  exportExcel: (params: ExpenseFilters) => downloadFile("/expenses/export", params as Record<string, string | number | undefined>, "expenses.xlsx"),
  createAdvance: async (body: Body) => (await api.post<{ id: Id }>("/expenses/advances", body)).data,
  advance: async (id: Id) => (await api.get<{ advance: Advance; can: { decide: boolean; pay: boolean } }>(`/expenses/advances/${id}`)).data,
  decideAdvance: async (id: Id, body: Body) => (await api.post<{ advance: Advance }>(`/expenses/advances/${id}/decision`, body)).data,
  payAdvance: async (id: Id, body: Body) => (await api.post<{ advance: Advance }>(`/expenses/advances/${id}/pay`, body)).data,
  cancelAdvance: async (id: Id) => (await api.post<{ advance: Advance }>(`/expenses/advances/${id}/cancel`)).data,
  advanceFile: async (id: Id, index: number) => (await api.get<{ url: string }>(`/expenses/advances/${id}/files/${index}`)).data.url,
  createClaim: async (body: Body) => (await api.post<ClaimDetail>("/expenses/claims", body)).data,
  updateClaim: async (id: Id, body: Body) => (await api.put<ClaimDetail>(`/expenses/claims/${id}`, body)).data,
  claim: async (id: Id) => (await api.get<ClaimDetail>(`/expenses/claims/${id}`)).data,
  decideClaim: async (id: Id, body: Body) => (await api.post<ClaimDetail>(`/expenses/claims/${id}/decision`, body)).data,
  payClaim: async (id: Id, body: Body) => (await api.post<ClaimDetail>(`/expenses/claims/${id}/pay`, body)).data,
  deleteClaim: async (id: Id) => {
    await api.delete(`/expenses/claims/${id}`);
  },
  claimFile: async (id: Id, index: number) => (await api.get<{ url: string }>(`/expenses/claims/${id}/files/${index}`)).data.url,
  claimPdf: (id: Id) => openFile(`/expenses/claims/${id}/pdf`, undefined, "expense.pdf"),
};
