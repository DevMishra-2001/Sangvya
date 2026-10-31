import { api } from "@/lib/api/client";

export const settingsService = {
  saveFontSize: async (fontSize: number) => (await api.put<{ fontSize: number }>("/settings/font-size", { fontSize })).data.fontSize,
  // Theme / accent / menu layout (any subset)
  savePreferences: async (prefs: { theme?: string; accent?: string; menuLayout?: string }) => {
    await api.put("/settings/preferences", prefs);
  },
  changePassword: async (newPassword: string) => {
    await api.put("/settings/password", { newPassword });
  },
};
