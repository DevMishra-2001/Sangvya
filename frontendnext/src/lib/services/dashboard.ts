import { api } from "@/lib/api/client";
import type { CompanyOverview } from "@/lib/types";

export const dashboardService = {
  overview: async () => (await api.get<CompanyOverview>("/dashboard/overview")).data,
};
