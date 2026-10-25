import { api } from "@/lib/api/client";
import type { Designation, Id } from "@/lib/types";

export const designationsService = {
  list: async () => (await api.get<{ designations: Designation[] }>("/designations")).data.designations,
  // The starter list every company gets (available before a company exists)
  defaults: async () => (await api.get<{ designations: string[] }>("/designations/defaults")).data.designations,
  create: async (name: string) => (await api.post<{ designation: Designation }>("/designations", { name })).data.designation,
  rename: async (id: Id, name: string) => (await api.patch<{ designation: Designation }>(`/designations/${id}`, { name })).data.designation,
  remove: async (id: Id) => {
    await api.delete(`/designations/${id}`);
  },
};
