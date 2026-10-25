// My employee profile (photo, designation…) for the header avatar and profile panel
import { create } from "zustand";
import { run } from "@/lib/api/run";
import { profileService } from "@/lib/services/profile";
import type { MyProfile } from "@/lib/types";

interface ProfileState {
  profile: MyProfile | null;
  load: () => Promise<void>;
  setPhoto: (url: string | null) => Promise<boolean>;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,

  async load() {
    const result = await run(profileService.get, { silent: true });
    if (result.ok) set({ profile: result.data });
  },

  async setPhoto(url) {
    const result = await run(() => profileService.setPhoto(url), { success: url ? "Photo updated" : "Photo removed" });
    if (result.ok) set({ profile: result.data });
    return result.ok;
  },

  clear: () => set({ profile: null }),
}));
