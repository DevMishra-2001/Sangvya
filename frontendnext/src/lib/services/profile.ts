import { api } from "@/lib/api/client";
import type { MyProfile } from "@/lib/types";

// The logged-in user's own employee record (/api/me/profile)
export const profileService = {
  get: async () => (await api.get<{ employee: MyProfile }>("/me/profile")).data.employee,
  setPhoto: async (photoUrl: string | null) => (await api.put<{ employee: MyProfile }>("/me/photo", { photoUrl })).data.employee,
};
