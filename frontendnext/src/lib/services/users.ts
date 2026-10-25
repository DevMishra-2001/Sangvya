import { api } from "@/lib/api/client";
import type { Role } from "@/lib/permissions";
import type { Id, UserRow } from "@/lib/types";
import type { UserPayload } from "@/lib/schemas/user";

export const usersService = {
  list: async () => (await api.get<{ users: UserRow[]; roles: Role[] }>("/users")).data,
  create: async (payload: UserPayload) => (await api.post<{ user: UserRow }>("/users", payload)).data.user,
  update: async (id: Id, payload: { role?: Role; employeeId?: Id | null; name?: string }) =>
    (await api.put<{ user: UserRow }>(`/users/${id}`, payload)).data.user,
  remove: async (id: Id) => {
    await api.delete(`/users/${id}`);
  },
};
