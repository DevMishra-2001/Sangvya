// Page Master list (Super Admin). Saving refreshes the logged-in user's own
// pages too, so the sidebar shows the change straight away.
import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { PagePayload } from "@/lib/schemas/page";
import { pagesService } from "@/lib/services/pages";
import type { Id, PageRow } from "@/lib/types";
import { useAuthStore } from "./auth-store";

interface PagesState {
  list: PageRow[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (id: Id | null, payload: PagePayload) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

const bySort = (a: PageRow, b: PageRow) => a.sort_order - b.sort_order || a.id - b.id;

export const usePagesStore = create<PagesState>((set, get) => ({
  list: [],
  loaded: false,

  async load() {
    const result = await run(pagesService.list);
    if (result.ok) set({ list: result.data.sort(bySort), loaded: true });
  },

  async save(id, payload) {
    const result = await run(() => (id ? pagesService.update(id, payload) : pagesService.create(payload)), { success: id ? "Page updated" : "Page added" });
    if (!result.ok) return false;
    const rest = get().list.filter((p) => p.id !== result.data.id);
    set({ list: [...rest, result.data].sort(bySort) });
    useAuthStore.getState().loadMe(); // my own menu may have changed
    return true;
  },

  async remove(id) {
    const result = await run(() => pagesService.remove(id), { success: "Page removed" });
    if (!result.ok) return;
    // Children move to the top level, like on the server
    set({ list: get().list.filter((p) => p.id !== id).map((p) => (p.parent_id === id ? { ...p, parent_id: null } : p)) });
    useAuthStore.getState().loadMe();
  },
}));
