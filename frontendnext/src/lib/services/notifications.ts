import { api } from "@/lib/api/client";
import type { AppNotification, Id } from "@/lib/types";

export const notificationsService = {
  list: async (before?: Id) =>
    (await api.get<{ notifications: AppNotification[]; nextCursor: Id | null; unread: number }>("/notifications", { params: { before, limit: 20 } })).data,
  unreadCount: async () => (await api.get<{ unread: number }>("/notifications/unread-count")).data.unread,
  markRead: async (id: Id) => (await api.patch<{ unread: number }>(`/notifications/${id}/read`)).data.unread,
  markAllRead: async () => (await api.post<{ unread: number }>("/notifications/read-all")).data.unread,
};
