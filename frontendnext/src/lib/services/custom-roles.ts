import { api } from "@/lib/api/client";
import type { CustomRolesData, Id } from "@/lib/types";
import type { CustomRolePayload } from "@/lib/schemas/custom-role";

type Body = CustomRolePayload & { pageIds: number[] };

// A company's own roles (Admin)
export const customRolesService = {
  list: async () => (await api.get<CustomRolesData>("/custom-roles")).data,
  create: async (body: Body) => {
    await api.post("/custom-roles", body);
  },
  update: async (id: Id, body: Body) => {
    await api.put(`/custom-roles/${id}`, body);
  },
  remove: async (id: Id) => {
    await api.delete(`/custom-roles/${id}`);
  },
};
