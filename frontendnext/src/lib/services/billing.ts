import { api } from "@/lib/api/client";
import type { BillingStatus, Invoice, SubscribeResponse } from "@/lib/types";

export const billingService = {
  status: async () => (await api.get<BillingStatus>("/billing/status")).data,
  invoices: async () => (await api.get<{ invoices: Invoice[] }>("/billing/invoices")).data.invoices,
  subscribe: async () => (await api.post<SubscribeResponse>("/billing/subscribe")).data,
  cancel: async () => (await api.post<{ message: string }>("/billing/cancel")).data,
};
