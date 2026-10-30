import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { AdminInput } from "@/lib/schemas/admin";
import { adminsService } from "@/lib/services/admins";
import type { AdminRow, Id } from "@/lib/types";

// The last activation link the API returned (dev only) — shown so it can be tested without email
export interface DevLink {
  name: string;
  email: string;
  link: string;
}

interface AdminsState {
  list: AdminRow[];
  loaded: boolean;
  devLink: DevLink | null;
  load: () => Promise<void>;
  invite: (input: AdminInput) => Promise<boolean>;
  resend: (admin: AdminRow) => Promise<void>;
  remove: (id: Id) => Promise<void>;
  clearDevLink: () => void;
}

export const useAdminsStore = create<AdminsState>((set, get) => ({
  list: [],
  loaded: false,
  devLink: null,

  async load() {
    const result = await run(adminsService.list);
    if (result.ok) set({ list: result.data, loaded: true });
  },

  async invite(input) {
    const result = await run(() => adminsService.invite(input), { success: (d) => `Invitation sent to ${d.admin.email}` });
    if (!result.ok) return false;
    const { admin, activationLink } = result.data;
    set({ list: [...get().list, admin], devLink: activationLink ? { name: admin.name, email: admin.email, link: activationLink } : null });
    return true;
  },

  async resend(admin) {
    const result = await run(() => adminsService.resend(admin.id), { success: `New activation link sent to ${admin.email}` });
    if (!result.ok) return;
    const { invite_expires_at, activationLink } = result.data;
    set({
      list: get().list.map((a) => (a.id === admin.id ? { ...a, status: "invited", invite_expires_at } : a)),
      devLink: activationLink ? { name: admin.name, email: admin.email, link: activationLink } : null,
    });
  },

  async remove(id) {
    const result = await run(() => adminsService.remove(id), { success: "Admin removed" });
    if (result.ok) set({ list: get().list.filter((a) => a.id !== id) });
  },

  clearDevLink: () => set({ devLink: null }),
}));
