import { api } from "@/lib/api/client";
import type { AdminInput } from "@/lib/schemas/admin";
import type { AdminRow, Id } from "@/lib/types";

// activationLink is only returned outside production (for testing without email)
export const adminsService = {
  list: async () => (await api.get<{ admins: AdminRow[] }>("/admins")).data.admins,
  invite: async (input: AdminInput) => (await api.post<{ admin: AdminRow; activationLink?: string }>("/admins", input)).data,
  resend: async (id: Id) => (await api.post<{ invite_expires_at: string; activationLink?: string }>(`/admins/${id}/resend`)).data,
  remove: async (id: Id) => {
    await api.delete(`/admins/${id}`);
  },
};
