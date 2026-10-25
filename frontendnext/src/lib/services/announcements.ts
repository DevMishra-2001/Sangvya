import { api } from "@/lib/api/client";
import type { Announcement, Birthday, Id } from "@/lib/types";
import type { AnnouncementInput } from "@/lib/schemas/announcement";

export const announcementsService = {
  feed: async () => (await api.get<{ announcements: Announcement[]; birthdays: Birthday[] }>("/announcements/feed")).data,
  create: async (input: AnnouncementInput) => (await api.post<{ announcement: Announcement }>("/announcements", input)).data.announcement,
  remove: async (id: Id) => {
    await api.delete(`/announcements/${id}`);
  },
};
