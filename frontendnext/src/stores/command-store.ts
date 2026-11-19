import { create } from "zustand";

// Command palette (Ctrl/⌘+K) and the keyboard shortcuts help (?)
interface CommandState {
  palette: boolean;
  help: boolean;
  setPalette: (open: boolean) => void;
  setHelp: (open: boolean) => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  palette: false,
  help: false,
  setPalette: (palette) => set({ palette }),
  setHelp: (help) => set({ help }),
}));
