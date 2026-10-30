// Catalog, data and export for every report in the registry
import { asc, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { departments, users } from "../../db/schema.js";
import { can } from "../../utils/can.js";
import { ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { localDate } from "../../utils/workday.js";
import { toCsv } from "./exporters/csv.js";
import { toPdf } from "./exporters/pdf.js";
import { toXlsx } from "./exporters/xlsx.js";
import { REPORTS } from "./registry.js";
import { loadBrand } from "./branding.js";
import type { FilterDef, Filters, ReportDef, ReportResult } from "./types.js";

export const EXPORT_FORMATS = {
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false },
  csv: { type: "text/csv; charset=utf-8", inline: false },
  pdf: { type: "application/pdf", inline: true }, // opens in the browser's PDF viewer
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;

function find(user: Express.AuthUser, key: string): ReportDef {
  const def = REPORTS.find((r) => r.key === key);
  if (!def) throw new NotFoundError("No such report");
  if (!can(user, def.permission)) throw new ForbiddenError("You can't open this report");
  return def;
}

function defaultValue(f: FilterDef) {
  const today = localDate();
  const d = new Date(`${today}T00:00:00Z`);
  switch (f.default) {
    case "currentMonth":
      return today.slice(0, 7);
    case "previousMonth":
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 7);
    case "today":
      return today;
    case "monthStart":
      return `${today.slice(0, 7)}-01`;
    default:
      return f.default;
  }
}

// Filters as the browser renders them (company-specific options filled in)
async function filtersFor(companyId: number, def: ReportDef) {
  const depts = def.filters.some((f) => f.optionsFrom === "departments")
    ? await db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.company_id, companyId)).orderBy(asc(departments.name))
    : [];
  return def.filters.map((f) => ({
    ...f,
    default: defaultValue(f) ?? null,
    options: f.optionsFrom === "departments" ? depts.map((d) => ({ value: String(d.id), label: d.name })) : f.options,
  }));
}

// GET /api/reports — the reports this user can open, grouped
export function catalog(user: Express.AuthUser) {
  return {
    reports: REPORTS.filter((r) => can(user, r.permission)).map(({ key, title, description, group }) => ({ key, title, description, group })),
  };
}

// Known filters only, with defaults for the missing ones
function cleanFilters(def: ReportDef, raw: Record<string, unknown>): Filters {
  const out: Filters = {};
  for (const f of def.filters) {
    const v = typeof raw[f.key] === "string" && (raw[f.key] as string).trim() ? (raw[f.key] as string).trim() : defaultValue(f);
    if (v) out[f.key] = v;
  }
  return out;
}

// Screen and PDF show the main columns; Excel / CSV get every column
const summary = (r: ReportResult): ReportResult => ({ ...r, columns: r.columns.filter((c) => !c.exportOnly) });

// GET /api/reports/:key/meta — title and filters only (the data waits for Search)
export async function reportMeta(companyId: number, user: Express.AuthUser, key: string) {
  const def = find(user, key);
  return { report: { key: def.key, title: def.title, description: def.description, group: def.group }, filters: await filtersFor(companyId, def) };
}

// GET /api/reports/:key — the report's filters and its data (for the screen)
export async function runReport(companyId: number, user: Express.AuthUser, key: string, raw: Record<string, unknown>) {
  const def = find(user, key);
  const filters = cleanFilters(def, raw);
  const result = await def.build(companyId, filters);
  return { report: { key: def.key, title: def.title, description: def.description, group: def.group }, filters: await filtersFor(companyId, def), applied: filters, result: summary(result) };
}

// GET /api/reports/:key/export?format= — the same report as a file
export async function exportReport(companyId: number, user: Express.AuthUser, key: string, format: ExportFormat, raw: Record<string, unknown>) {
  const def = find(user, key);
  const result = await def.build(companyId, cleanFilters(def, raw));
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, user.id));
  const printedBy = me?.name;
  const brand = format === "csv" ? null : await loadBrand(companyId);
  const body =
    format === "xlsx" ? await toXlsx(result, { company: brand!.company.name, printedBy }) : format === "csv" ? toCsv(result) : await toPdf(summary(result), brand!, printedBy);
  return { body, fileName: `${result.fileName}.${format}`, ...EXPORT_FORMATS[format] };
}
