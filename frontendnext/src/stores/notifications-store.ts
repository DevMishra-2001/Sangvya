// The bell's state.
import { create } from "zustand";
import { run } from "@/lib/api/run";
import { notificationsService } from "@/lib/services/notifications";
import type { AppNotification, Id } from "@/lib/types";

interface NotificationsState {
  unread: number;
  list: AppNotification[];
  nextCursor: Id | null;
  loading: boolean;
  refreshCount: () => Promise<void>;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: Id) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  unread: 0,
  list: [],
  nextCursor: null,
  loading: false,

  async refreshCount() {
    const r = await run(notificationsService.unreadCount, { silent: true });
    if (r.ok) set({ unread: r.data });
  },

  async load() {
    set({ loading: true });
    const r = await run(() => notificationsService.list(), { silent: true });
    set({ loading: false, ...(r.ok ? { list: r.data.notifications, nextCursor: r.data.nextCursor, unread: r.data.unread } : {}) });
  },

  async loadMore() {
    const cursor = get().nextCursor;
    if (!cursor) return;
    const r = await run(() => notificationsService.list(cursor), { silent: true });
    if (r.ok) set({ list: [...get().list, ...r.data.notifications], nextCursor: r.data.nextCursor });
  },

  async markRead(id) {
    const item = get().list.find((n) => n.id === id);
    if (item?.read_at) return;
    // Optimistic: mark it straight away
    set({ list: get().list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)), unread: Math.max(0, get().unread - 1) });
    const r = await run(() => notificationsService.markRead(id), { silent: true });
    if (r.ok) set({ unread: r.data });
  },

  async markAllRead() {
    const r = await run(notificationsService.markAllRead);
    if (r.ok) set({ unread: 0, list: get().list.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) });
  },

  reset: () => set({ unread: 0, list: [], nextCursor: null }),
}));
