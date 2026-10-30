import { create } from "zustand";
import { run } from "@/lib/api/run";
import { platformCompaniesService, type PlatformStats } from "@/lib/services/platform-companies";
import type { CompanyStatus, Id, PlatformCompany, PlatformCompanyDetail, VerificationStatus } from "@/lib/types";

interface PlatformCompaniesState {
  list: PlatformCompany[];
  stats: PlatformStats | null;
  loaded: boolean;
  load: () => Promise<void>;
  setVerification: (id: Id, status: VerificationStatus, notes?: string) => Promise<PlatformCompanyDetail | null>;
  setStatus: (id: Id, status: CompanyStatus, reason?: string) => Promise<PlatformCompanyDetail | null>;
}

const VERIFY_MESSAGE: Record<VerificationStatus, string> = {
  verified: "Company verified",
  rejected: "Verification rejected",
  pending: "Marked as in review",
  unverified: "Marked as unverified",
};

export const usePlatformCompaniesStore = create<PlatformCompaniesState>((set, get) => {
  // Keep the row in the list in step with the detail the API returned
  const merge = (detail: PlatformCompanyDetail) => {
    set({ list: get().list.map((c) => (c.id === detail.id ? { ...c, verification_status: detail.verification_status, status: detail.status } : c)) });
    void get().load(); // refresh the counts at the top
  };

  return {
    list: [],
    stats: null,
    loaded: false,

    async load() {
      const result = await run(platformCompaniesService.list, { silent: get().loaded });
      if (result.ok) set({ list: result.data.companies, stats: result.data.stats, loaded: true });
    },

    async setVerification(id, status, notes) {
      const result = await run(() => platformCompaniesService.setVerification(id, status, notes), { success: VERIFY_MESSAGE[status] });
      if (!result.ok) return null;
      merge(result.data);
      return result.data;
    },

    async setStatus(id, status, reason) {
      const result = await run(() => platformCompaniesService.setStatus(id, status, reason), {
        success: status === "suspended" ? "Company suspended — its users are locked out" : "Company reactivated",
      });
      if (!result.ok) return null;
      merge(result.data);
      return result.data;
    },
  };
});
