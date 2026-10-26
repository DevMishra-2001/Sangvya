import { api } from "@/lib/api/client";
import type { Designation, Id } from "@/lib/types";

// The five fixed designations (Super Admin, Admin, HR, Accountant, Developer)
export const designationsService = {
  list: async () => (await api.get<{ designations: Designation[] }>("/designations")).data.designations,
  // Super Admin only: rename / switch active
  update: async (id: Id, changes: { name: string; isActive: boolean }) =>
    (await api.patch<{ designation: Designation }>(`/designations/${id}`, changes)).data.designation,
};
