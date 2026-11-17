import { api } from "@/lib/api/client";
import type { EmployeeBalances, Id, Leave, LeavePolicy } from "@/lib/types";
import type { LeavePayload, LeavePolicyInput } from "@/lib/schemas/leave";

export const leavesService = {
  list: async () => (await api.get<{ leaves: Leave[] }>("/leaves")).data.leaves,
  // note: set when the company turned it into unpaid leave because the balance was short
  apply: async (payload: LeavePayload) => (await api.post<{ leave: Leave; note?: string | null }>("/leaves", payload)).data,
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post<{ file: { path: string; name: string } }>("/leaves/files", form)).data.file;
  },
  file: async (id: Id, index: number) => (await api.get<{ url: string }>(`/leaves/${id}/files/${index}`)).data.url,
  decide: async (id: Id, status: "approved" | "rejected", note?: string) =>
    (await api.patch<{ leave: Leave }>(`/leaves/${id}/status`, { status, note })).data.leave,
  // Withdraw (pending) / cancel (approved, not started — or anything for HR)
  cancel: async (id: Id) => (await api.post<{ leave: Leave }>(`/leaves/${id}/cancel`)).data.leave,
  // Everyone's balances (HR)
  balances: async () => (await api.get<{ leaveYear: { start: string; end: string; kind: string } | null; employees: EmployeeBalances[] }>("/leaves/balances")).data,
  policy: async () => (await api.get<{ policy: LeavePolicy }>("/leave-policy")).data.policy,
  savePolicy: async (input: LeavePolicyInput) => (await api.put<{ policy: LeavePolicy }>("/leave-policy", input)).data.policy,
};
