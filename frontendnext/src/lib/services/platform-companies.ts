import { api } from "@/lib/api/client";
import type { AuditEntry, CompanyModule, CompanyStatus, Id, PlatformCompany, PlatformCompanyDetail, PlatformOverview, VerificationStatus } from "@/lib/types";

export interface PlatformStats {
  total: number;
  active: number;
  suspended: number;
  toReview: number;
  employees: number;
  trial: number;
  trialEnding: number;
  paid: number;
  pastDue: number;
  inactive: number;
}

export interface CompanyDetailResponse {
  company: PlatformCompanyDetail;
  modules: CompanyModule[];
  usage: { logins: number; checkins: number; leaves: number; payslips: number };
  admins: { id: Id; name: string; email: string }[];
}

// Super Admin: all companies on the platform
export const platformCompaniesService = {
  list: async () => (await api.get<{ companies: PlatformCompany[]; stats: PlatformStats }>("/platform/companies")).data,
  get: async (id: Id) => (await api.get<CompanyDetailResponse>(`/platform/companies/${id}`)).data,
  setSubscription: async (id: Id, body: { trialEndsOn?: string; pricePerEmployee?: number }) => (await api.patch<CompanyDetailResponse>(`/platform/companies/${id}/subscription`, body)).data,
  setNotes: async (id: Id, notes: string | null) => (await api.patch<CompanyDetailResponse>(`/platform/companies/${id}/notes`, { notes })).data,
  sendPasswordReset: async (id: Id, userId: Id) => (await api.post<{ sentTo: string }>(`/platform/companies/${id}/password-reset`, { userId })).data,
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
  from?: string;
  to?: string;
}

export interface PlatformSettings {
  pricePerEmployee: number;
  trialDays: number;
  razorpayPlanId: string;
  newCompanyModules: string[];
  inviteLinkHours: number;
  sessionIdleMinutes: number;
  sessionMaxHours: number;
  supportEmail: string;
  supportPhone: string;
  bannerEnabled: boolean;
  bannerText: string;
  bannerTone: "info" | "warning" | "danger";
}

export interface SettingsResponse {
  settings: PlatformSettings;
  defaults: PlatformSettings;
  updatedAt: string | null;
  modules: { key: string; name: string }[];
}

export interface InsightsCompany {
  id: Id;
  name: string;
  status: string;
  employees: number;
  active_users_7d: number;
  last_active_at: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  mrr: string;
}

export interface PlatformInsights {
  revenue: { mrr: number; arr: number; paying: number; trial: number; pastDue: number; cancelled: number; conversionRate: number | null; avgPerCompany: number };
  monthly: { month: string; companies: number; revenue: number; payments: number }[];
  daily: { day: string; logins: number; active_users: number; checkins: number }[];
  modules: Record<string, number>;
  trialsEnding: InsightsCompany[];
  pastDue: InsightsCompany[];
  atRisk: InsightsCompany[];
  mostActive: InsightsCompany[];
  topRevenue: InsightsCompany[];
}

export interface PlatformHealth {
  jobs: {
    name: string;
    everyMin: number;
    what: string;
    last_run: string | null;
    last_ok: string | null;
    last_error_at: string | null;
    last_error: string | null;
    last_detail: string | null;
    runs_24h: number;
    failed_24h: number;
    state: "ok" | "late" | "failing" | "waiting";
  }[];
  mail: {
    smtpConfigured: boolean;
    redirectedTo: string | null;
    last7Days: { sent: number; failed: number; logged: number };
    daily: { day: string; sent: number; failed: number; logged: number }[];
    failures: { to_email: string; subject: string; error: string | null; created_at: string }[];
  };
  database: { size: string; connections: number; biggestTables: { name: string; rows: number }[] };
  server: { environment: string; node: string; startedAt: string; uptimeMin: number; memoryMb: number; heapMb: number };
}

export interface BroadcastInput {
  title: string;
  message: string;
  audience: "admins" | "everyone";
  companyIds: number[];
  email: boolean;
  dryRun?: boolean;
}

// Super Admin: the audit log and the platform overview
export const platformService = {
  audit: async (filters: AuditFilters = {}) => (await api.get<{ entries: AuditEntry[]; nextCursor: Id | null }>("/platform/audit", { params: filters })).data,
  overview: async () => (await api.get<PlatformOverview>("/platform/overview")).data,
  auditExport: async (filters: AuditFilters = {}) => (await api.get<Blob>("/platform/audit/export", { params: filters, responseType: "blob" })).data,
  settings: async () => (await api.get<SettingsResponse>("/platform/settings")).data,
  saveSettings: async (body: PlatformSettings) => (await api.put<SettingsResponse>("/platform/settings", body)).data,
  insights: async () => (await api.get<PlatformInsights>("/platform/insights")).data,
  health: async () => (await api.get<PlatformHealth>("/platform/health")).data,
  broadcastHistory: async () => (await api.get<{ history: { id: Id; summary: string; actor_email: string | null; created_at: string }[] }>("/platform/broadcast")).data.history,
  broadcast: async (body: BroadcastInput) => (await api.post<{ companies: number; people: number; sent: boolean }>("/platform/broadcast", body)).data,
};
