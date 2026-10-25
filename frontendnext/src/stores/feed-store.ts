// Announcements + today's birthdays for the dashboard
import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { AnnouncementInput } from "@/lib/schemas/announcement";
import { announcementsService } from "@/lib/services/announcements";
import type { Announcement, Birthday, Id } from "@/lib/types";

interface FeedState {
  announcements: Announcement[];
  birthdays: Birthday[];
  load: () => Promise<void>;
  post: (input: AnnouncementInput) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  announcements: [],
  birthdays: [],

  async load() {
    const result = await run(announcementsService.feed, { silent: true });
    if (result.ok) set(result.data);
  },

  async post(input) {
    const result = await run(() => announcementsService.create(input), { success: "Announcement published" });
    if (result.ok) await get().load();
    return result.ok;
  },

  async remove(id) {
    const result = await run(() => announcementsService.remove(id), { success: "Announcement deleted" });
    if (result.ok) set({ announcements: get().announcements.filter((a) => a.id !== id) });
  },
}));
