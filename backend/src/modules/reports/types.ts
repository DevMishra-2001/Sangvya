// Shared shapes for every report and exporter
import type { Permission } from "../../config/permissions.js";

export type ColumnType = "text" | "number" | "money" | "date" | "code";
export type Cell = string | number | null;

export interface Column {
  key: string;
  label: string;
  type?: ColumnType;
  width?: number; // in characters (Excel); PDF scales from it
  exportOnly?: boolean; // detail: in Excel / CSV only, not on screen or in the PDF
}

export interface ReportResult {
  title: string;
  subtitle?: string; // filters in words, e.g. "October 2026 · Engineering"
  columns: Column[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
  landscape?: boolean; // wide reports (PDF)
  fileName: string; // without extension
}

export type FilterType = "month" | "date" | "select";

export interface FilterDef {
  key: string;
  label: string;
  type: FilterType;
  required?: boolean;
  options?: { value: string; label: string }[]; // select
  optionsFrom?: "departments"; // filled per company
  default?: "currentMonth" | "previousMonth" | "today" | "monthStart" | string;
}

export type Filters = Record<string, string | undefined>;

export interface ReportDef {
  key: string;
  title: string;
  description: string;
  group: "Attendance" | "Leave" | "Payroll" | "People";
  permission: Permission;
  filters: FilterDef[];
  build: (companyId: number, filters: Filters) => Promise<ReportResult>;
}
