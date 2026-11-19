import { create } from "zustand";
import { run } from "@/lib/api/run";
import { ticketsService, type TicketMeta } from "@/lib/services/tickets";

// Ticket lists (projects, statuses…), people and powers — loaded once, reloaded after settings change
interface TicketMetaState {
  meta: TicketMeta | null;
  load: (force?: boolean) => Promise<void>;
}

let loading: Promise<void> | null = null;

export const useTicketMeta = create<TicketMetaState>((set, get) => ({
  meta: null,
  load(force) {
    if (get().meta && !force) return Promise.resolve();
    loading ??= run(ticketsService.meta, { silent: true })
      .then((r) => {
        if (r.ok) set({ meta: r.data });
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },
}));
