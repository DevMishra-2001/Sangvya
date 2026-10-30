import { api } from "@/lib/api/client";
import type { EmployeeBalances, Id, Leave, LeavePolicy } from "@/lib/types";
import type { LeavePayload, LeavePolicyInput } from "@/lib/schemas/leave";

export const leavesService = {
  list: async () => (await api.get<{ leaves: Leave[] }>("/leaves")).data.leaves,
  apply: async (payload: LeavePayload) => (await api.post<{ leave: Leave }>("/leaves", payload)).data.leave,
  decide: async (id: Id, status: "approved" | "rejected", note?: string) =>
    (await api.patch<{ leave: Leave }>(`/leaves/${id}/status`, { status, note })).data.leave,
  // Withdraw (pending) / cancel (approved, not started — or anything for HR)
  cancel: async (id: Id) => (await api.post<{ leave: Leave }>(`/leaves/${id}/cancel`)).data.leave,
  // Everyone's balances (HR)
  balances: async () => (await api.get<{ leaveYear: { start: string; end: string; kind: string } | null; employees: EmployeeBalances[] }>("/leaves/balances")).data,
  policy: async () => (await api.get<{ policy: LeavePolicy }>("/leave-policy")).data.policy,
  savePolicy: async (input: LeavePolicyInput) => (await api.put<{ policy: LeavePolicy }>("/leave-policy", input)).data.policy,
};
