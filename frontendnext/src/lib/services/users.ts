import { api } from "@/lib/api/client";
import type { Id, UserRow } from "@/lib/types";
import type { UserPayload } from "@/lib/schemas/user";

export const usersService = {
  list: async () => (await api.get<{ users: UserRow[] }>("/users")).data.users,
  create: async (payload: UserPayload) => (await api.post<{ user: UserRow }>("/users", payload)).data.user,
  update: async (id: Id, payload: { employeeId?: Id | null; name?: string }) => (await api.put<{ user: UserRow }>(`/users/${id}`, payload)).data.user,
  remove: async (id: Id) => {
    await api.delete(`/users/${id}`);
  },
};
