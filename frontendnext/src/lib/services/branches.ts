import { api } from "@/lib/api/client";
import type { Branch, Id } from "@/lib/types";
import type { BranchPayload } from "@/lib/schemas/branch";

export const branchesService = {
  list: async () => (await api.get<{ branches: Branch[] }>("/branches")).data.branches,
  create: async (body: BranchPayload) => (await api.post<{ branch: Branch }>("/branches", body)).data.branch,
  update: async (id: Id, body: BranchPayload) => (await api.put<{ branch: Branch }>(`/branches/${id}`, body)).data.branch,
  remove: async (id: Id) => {
    await api.delete(`/branches/${id}`);
  },
};
