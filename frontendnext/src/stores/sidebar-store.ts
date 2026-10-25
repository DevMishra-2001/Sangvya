// Desktop sidebar open (labels) / collapsed (icons only), remembered per browser.
// skipHydration: the server renders it open; Sidebar rehydrates after mount.
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: "sangvya-sidebar", skipHydration: true },
  ),
);
