import { api } from "@/lib/api/client";

export const settingsService = {
  saveFontSize: async (fontSize: number) => (await api.put<{ fontSize: number }>("/settings/font-size", { fontSize })).data.fontSize,
  changePassword: async (newPassword: string) => {
    await api.put("/settings/password", { newPassword });
  },
};
