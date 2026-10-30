import { api } from "@/lib/api/client";
import { downloadFile, openFile } from "@/lib/download";
import type { ReportResponse } from "@/lib/types";

export type ExportFormat = "xlsx" | "csv" | "pdf";

export interface ReportSettings {
  letterhead: boolean;
  showLogo: boolean;
  showAddress: boolean;
  showContact: boolean;
  showTaxIds: boolean;
  footerText: string | null;
  watermark: string | null;
  signatureLabel: string | null;
  showGenerated: boolean;
}

export const reportsService = {
  settings: async () => (await api.get<{ settings: ReportSettings }>("/reports/settings")).data.settings,
  saveSettings: async (s: ReportSettings) => (await api.put<{ settings: ReportSettings }>("/reports/settings", s)).data.settings,
  preview: () => openFile("/reports/settings/preview", undefined, "report-preview.pdf"),
  catalog: async () => (await api.get<{ reports: { key: string; title: string; description: string; group: string }[] }>("/reports")).data.reports,
  meta: async (key: string) => (await api.get<Pick<ReportResponse, "report" | "filters">>(`/reports/${key}/meta`)).data,
  run: async (key: string, filters: Record<string, string>) => (await api.get<ReportResponse>(`/reports/${key}`, { params: filters })).data,
  // Excel / CSV download; PDF opens in a new tab
  export: (key: string, format: ExportFormat, filters: Record<string, string>) =>
    format === "pdf" ? openFile(`/reports/${key}/export`, { ...filters, format }) : downloadFile(`/reports/${key}/export`, { ...filters, format }, `${key}.${format}`),
};
