import { api } from "@/lib/api/client";
import type { Id, Leave, LeavePolicy } from "@/lib/types";
import type { LeavePayload, LeavePolicyInput } from "@/lib/schemas/leave";

export const leavesService = {
  list: async () => (await api.get<{ leaves: Leave[] }>("/leaves")).data.leaves,
  apply: async (payload: LeavePayload) => (await api.post<{ leave: Leave }>("/leaves", payload)).data.leave,
  decide: async (id: Id, status: "approved" | "rejected") =>
    (await api.patch<{ leave: Leave }>(`/leaves/${id}/status`, { status })).data.leave,
  policy: async () => (await api.get<{ policy: LeavePolicy }>("/leave-policy")).data.policy,
  savePolicy: async (input: LeavePolicyInput) => (await api.put<{ policy: LeavePolicy }>("/leave-policy", input)).data.policy,
};
