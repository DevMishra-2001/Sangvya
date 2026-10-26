import { api } from "@/lib/api/client";
import type { AdminInput } from "@/lib/schemas/admin";
import type { AdminRow, Id } from "@/lib/types";

// Company-owner logins (Super Admin)
export const adminsService = {
  list: async () => (await api.get<{ admins: AdminRow[] }>("/admins")).data.admins,
  create: async (input: AdminInput) => (await api.post<{ admin: AdminRow }>("/admins", input)).data.admin,
  remove: async (id: Id) => {
    await api.delete(`/admins/${id}`);
  },
};
