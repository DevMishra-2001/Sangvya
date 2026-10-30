import { api } from "@/lib/api/client";
import type { Id, Role } from "@/lib/types";

// The five fixed roles (Super Admin, Admin, HR, Accountant, Employee)
export const rolesService = {
  list: async () => (await api.get<{ roles: Role[] }>("/roles")).data.roles,
  // Super Admin only: rename / switch active
  update: async (id: Id, changes: { name: string; isActive: boolean }) => (await api.patch<{ role: Role }>(`/roles/${id}`, changes)).data.role,
};
