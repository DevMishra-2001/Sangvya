// The accent color, saved per browser. The inline script in app/layout.tsx
// applies it before the first paint; this store keeps it in sync afterwards.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, applyAccent, type Accent } from "@/lib/appearance";

interface AppearanceState {
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      accent: DEFAULT_ACCENT,
      setAccent(accent) {
        applyAccent(accent);
        set({ accent });
      },
    }),
    { name: ACCENT_STORAGE_KEY },
  ),
);
