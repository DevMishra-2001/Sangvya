import { api } from "@/lib/api/client";
import type { AuditEntry, CompanyModule, CompanyStatus, Id, PlatformCompany, PlatformCompanyDetail, PlatformOverview, VerificationStatus } from "@/lib/types";

export interface PlatformStats {
  total: number;
  active: number;
  suspended: number;
  toReview: number;
  employees: number;
}

// Super Admin: all companies on the platform
export const platformCompaniesService = {
  list: async () => (await api.get<{ companies: PlatformCompany[]; stats: PlatformStats }>("/platform/companies")).data,
  get: async (id: Id) => (await api.get<{ company: PlatformCompanyDetail; modules: CompanyModule[] }>(`/platform/companies/${id}`)).data,
  setModules: async (id: Id, modules: Record<string, boolean>) =>
    (await api.patch<{ modules: CompanyModule[] }>(`/platform/companies/${id}/modules`, { modules })).data.modules,
  setVerification: async (id: Id, status: VerificationStatus, notes?: string) =>
    (await api.patch<{ company: PlatformCompanyDetail }>(`/platform/companies/${id}/verification`, { status, notes })).data.company,
  setStatus: async (id: Id, status: CompanyStatus, reason?: string) =>
    (await api.patch<{ company: PlatformCompanyDetail }>(`/platform/companies/${id}/status`, { status, reason })).data.company,
};

export interface AuditFilters {
  action?: string;
  companyId?: Id;
  q?: string;
  before?: Id;
}

// Super Admin: the audit log and the platform overview
export const platformService = {
  audit: async (filters: AuditFilters = {}) => (await api.get<{ entries: AuditEntry[]; nextCursor: Id | null }>("/platform/audit", { params: filters })).data,
  overview: async () => (await api.get<PlatformOverview>("/platform/overview")).data,
};
