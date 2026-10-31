// Who is logged in. The session itself lives in HttpOnly cookies — nothing
// about it is stored in the browser; "who am I?" is answered by GET /auth/me.
import { create } from "zustand";
import { setSessionUser } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import type { Permission } from "@/lib/permissions";
import type { LoginInput } from "@/lib/schemas/auth";
import { authService } from "@/lib/services/auth";
import { settingsService } from "@/lib/services/settings";
import { broadcast } from "@/lib/session/activity";
import type { CompanyInput } from "@/lib/schemas/company";
import { companiesService } from "@/lib/services/companies";
import type { AppPage, AuthResponse, Company, Id, SessionInfo, User } from "@/lib/types";
import { useNotificationsStore } from "./notifications-store";

interface AuthState {
  user: User | null;
  company: Company | null; // the user's current company (null until they create one)
  // Pages this user can open (Page Master) — arrives with login / me, loaded once
  pages: AppPage[];
  checked: boolean; // has the startup /auth/me check finished?
  session: SessionInfo;
  loadMe: () => Promise<void>;
  login: (input: LoginInput) => Promise<boolean>;
  // Activation link: set my password and log in. Returns the invited company name (to pre-fill setup).
  acceptInvite: (token: string, password: string) => Promise<{ ok: boolean; companyName: string | null }>;
  logout: (opts?: { fromOtherTab?: boolean }) => Promise<void>;
  sessionEnded: () => void;
  previewFontSize: (size: number) => void;
  saveFontSize: (size: number) => Promise<boolean>;
  // Saved to the account (shown at once; put back if saving fails)
  savePreferences: (prefs: Partial<Pick<User, "theme" | "accent" | "menu_layout">>) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<boolean>;
  createCompany: (input: CompanyInput) => Promise<boolean>;
  switchCompany: (id: Id) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const signedIn = (data: AuthResponse) => {
    setSessionUser(data.user.id);
    set({ user: data.user, company: data.company, pages: data.pages ?? [], session: data.session, checked: true });
  };

  return {
    user: null,
    company: null,
    pages: [],
    checked: false,
    session: { accessTtlMin: 5, idleMin: 20 },

    async loadMe() {
      const result = await run(authService.me, { silent: true });
      if (result.ok) signedIn(result.data);
      else set({ user: null, checked: true });
    },

    async login(input) {
      const result = await run(() => authService.login(input), { error: "Login failed" });
      if (result.ok) signedIn(result.data);
      return result.ok;
    },

    async acceptInvite(token, password) {
      const result = await run(() => authService.acceptInvite(token, password), { success: "Account activated — welcome!" });
      if (!result.ok) return { ok: false, companyName: null };
      signedIn(result.data);
      return { ok: true, companyName: result.data.companyName };
    },

    // Ends the session on the server and tells other open tabs to log out too.
    // fromOtherTab: another tab already made the server call.
    async logout({ fromOtherTab = false } = {}) {
      setSessionUser(null);
      set({ user: null, company: null, pages: [] });
      useNotificationsStore.getState().reset(); // the next person mustn't see these
      if (fromOtherTab) return;
      broadcast({ type: "logout" });
      await authService.logout().catch(() => {}); // already logged out / offline — local state is cleared anyway
    },

    // The session could not be refreshed / was revoked — drop the user locally
    sessionEnded() {
      setSessionUser(null);
      set({ user: null, company: null, pages: [] });
    },

    // Live preview while dragging the font slider (not saved yet)
    previewFontSize(size) {
      const user = get().user;
      if (user) set({ user: { ...user, font_size: size } });
    },

    async saveFontSize(size) {
      const result = await run(() => settingsService.saveFontSize(size), { success: "Font size saved" });
      if (result.ok) get().previewFontSize(result.data);
      return result.ok;
    },

    async savePreferences(prefs) {
      const before = get().user;
      if (!before) return false;
      set({ user: { ...before, ...prefs } });
      const result = await run(() => settingsService.savePreferences({ theme: prefs.theme, accent: prefs.accent, menuLayout: prefs.menu_layout }), { error: "Couldn't save your preference" });
      if (!result.ok) {
        const now = get().user;
        if (now) set({ user: { ...now, theme: before.theme, accent: before.accent, menu_layout: before.menu_layout } });
      }
      return result.ok;
    },

    // Creates a company and makes it the current one
    async createCompany(input) {
      const result = await run(() => companiesService.create(input), { success: `${input.companyName} is ready` });
      if (result.ok) signedIn(result.data);
      return result.ok;
    },

    async switchCompany(id) {
      const result = await run(() => companiesService.switch(id), { success: (d) => `Switched to ${d.company?.name}` });
      if (result.ok) signedIn(result.data);
      return result.ok;
    },

    async changePassword(newPassword) {
      const result = await run(() => settingsService.changePassword(newPassword), { success: "Password updated successfully" });
      return result.ok;
    },
  };
});

// can("payroll.view") for the logged-in user. Uses the permission list the
// backend sends with the user, so buttons follow the server's rules exactly.
export function useCan() {
  const permissions = useAuthStore((s) => s.user?.permissions);
  return (permission: Permission) => permissions?.includes(permission) ?? false;
}

// The logged-in user (only inside the app shell, which waits for it)
export function useUser(): User {
  const user = useAuthStore((s) => s.user);
  if (!user) throw new Error("useUser() used outside the logged-in app shell");
  return user;
}
