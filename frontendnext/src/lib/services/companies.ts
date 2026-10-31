import { api } from "@/lib/api/client";
import type { AuthResponse, Company, CompanyListItem, Id } from "@/lib/types";
import type { CompanyInput } from "@/lib/schemas/company";

// Creating / switching answers like GET /auth/me (and the server re-issues the login token)
export const companiesService = {
  mine: async () => (await api.get<{ companies: CompanyListItem[] }>("/companies")).data.companies,
  create: async (input: CompanyInput) => (await api.post<AuthResponse>("/companies", input)).data,
  switch: async (id: Id) => (await api.post<AuthResponse>(`/companies/${id}/switch`)).data,
  // Company settings (Admin)
  current: async () => (await api.get<{ company: Company }>("/companies/current")).data.company,
  update: async (input: CompanyInput) => (await api.put<{ company: Company }>("/companies/current", input)).data.company,
};
