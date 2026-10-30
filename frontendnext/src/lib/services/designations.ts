import { api } from "@/lib/api/client";
import type { Designation, Id } from "@/lib/types";

// The company's job titles
export const designationsService = {
  list: async () => (await api.get<{ designations: Designation[] }>("/designations")).data.designations,
  create: async (input: { name: string; isActive: boolean }) => (await api.post<{ designation: Designation }>("/designations", input)).data.designation,
  update: async (id: Id, input: { name: string; isActive: boolean }) => (await api.put<{ designation: Designation }>(`/designations/${id}`, input)).data.designation,
  remove: async (id: Id) => {
    await api.delete(`/designations/${id}`);
  },
};
