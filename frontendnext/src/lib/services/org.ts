import { api } from "@/lib/api/client";
import type { Id } from "@/lib/types";

export interface OrgNode {
  id: Id;
  name: string;
  photo_url: string | null;
  designation: string | null;
  department: string | null;
  report_count: number;
}

export interface OrgOverview {
  stats: { total: number; departments: number; leaders: number; levels: number };
  me: { managers: OrgNode[]; self: OrgNode; reports: OrgNode[] } | null;
  roots: OrgNode[];
  unassigned: number;
  departments: { id: Id | null; name: string; count: number }[];
}

export interface OrgMember {
  id: Id;
  name: string;
  photo_url: string | null;
  employee_code: string | null;
  designation: string | null;
  branch: string | null;
  manager_name: string | null;
  join_date: string | null;
  status: "active" | "notice" | "exited";
  report_count: number;
}

export interface Paged {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const orgService = {
  overview: async () => (await api.get<OrgOverview>("/org-chart")).data,
  reports: async (id: Id) => (await api.get<{ reports: OrgNode[] }>(`/org-chart/${id}/reports`)).data.reports,
  members: async (department: Id | "none", params: { page: number; limit: number; search?: string }) =>
    (await api.get<{ department: { id: Id | null; name: string }; members: OrgMember[] } & Paged>(`/org-chart/departments/${department}/members`, { params })).data,
};
