"use client";

import { useEffect, useState } from "react";
import { FileBarChart, FileSpreadsheet, FileText, Search, Sheet } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { MonthPicker } from "@/components/common/month-picker";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import { reportsService, type ExportFormat } from "@/lib/services/reports";
import type { ReportCell, ReportColumn, ReportResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

// Attendance register codes → colors (always next to the code itself)
const CODE_TONES: Record<string, string> = { P: "text-success", A: "text-destructive font-semibold", HD: "text-warning", WO: "text-muted-foreground", H: "text-info" };

function cell(c: ReportColumn, v: ReportCell) {
  if (v == null || v === "") return "";
  if (c.type === "money") return Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(v);
}

const align = (c: ReportColumn) => (c.type === "number" || c.type === "money" ? "text-right" : c.type === "code" ? "text-center" : "text-left");

// Any report: filters → Search shows the table; Excel / CSV / PDF export the same filters
export function ReportView({ reportKey }: { reportKey: string }) {
  const [meta, setMeta] = useState<Pick<ReportResponse, "report" | "filters"> | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [result, setResult] = useState<ReportResponse["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  useEffect(() => {
    let cancelled = false;
    reportsService
      .meta(reportKey)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setValues(Object.fromEntries(m.filters.filter((f) => f.default).map((f) => [f.key, f.default!])));
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [reportKey]);

  function set(key: string, value: string) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (!value) delete next[key];
      return next;
    });
    setMissing((m) => m.filter((k) => k !== key));
  }

  // Required filters filled? (marks the empty ones)
  function ready() {
    const empty = (meta?.filters ?? []).filter((f) => f.required && !values[f.key]).map((f) => f.key);
    setMissing(empty);
    return empty.length === 0;
  }

  async function search() {
    if (!ready()) return;
    setSearching(true);
    const r = await run(() => reportsService.run(reportKey, values));
    setSearching(false);
    if (r.ok) setResult(r.data.result);
  }

  async function exportAs(format: ExportFormat) {
    if (!ready()) return;
    setExporting(format);
    await run(() => reportsService.export(reportKey, format, values), { error: "Couldn't create the file" });
    setExporting(null);
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!meta) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading report">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  const busy = searching || exporting !== null;
  const first = result?.columns[0]?.key;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader title={meta.report.title} description={meta.report.description} className="mb-0" />

      <FormCard title={meta.report.title} crumbs={["Reports"]} icon={FileBarChart}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <FormGrid>
            {meta.filters.map((f) => {
              const id = `rf-${f.key}`;
              const err = missing.includes(f.key) ? { message: `Pick the ${f.label.toLowerCase()}` } : undefined;
              return (
                <FormField key={f.key} label={f.label} htmlFor={id} required={f.required} error={err}>
                  {f.type === "month" ? (
                    <MonthPicker id={id} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} invalid={Boolean(err)} />
                  ) : f.type === "date" ? (
                    <DatePicker id={id} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} invalid={Boolean(err)} />
                  ) : (
                    <SelectField
                      id={id}
                      value={values[f.key] ?? ""}
                      onValueChange={(v) => set(f.key, v)}
                      emptyLabel={f.required ? undefined : "All"}
                      options={f.options ?? []}
                      invalid={Boolean(err)}
                    />
                  )}
                </FormField>
              );
            })}
            <FormActions span="md" className="flex-wrap">
              <Button type="submit" disabled={busy}>
                {searching ? <Spinner /> : <Search />} Search
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => exportAs("xlsx")}>
                {exporting === "xlsx" ? <Spinner /> : <FileSpreadsheet />} Excel
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => exportAs("csv")}>
                {exporting === "csv" ? <Spinner /> : <Sheet />} CSV
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => exportAs("pdf")}>
                {exporting === "pdf" ? <Spinner /> : <FileText />} PDF
              </Button>
            </FormActions>
          </FormGrid>
        </form>
      </FormCard>

      {!result ? (
        <EmptyState icon={Search} title="Choose the filters and press Search" description="Or export straight to Excel, CSV or PDF." />
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading
            title={result.subtitle ?? meta.report.title}
            actions={
              <span className="text-xs text-muted-foreground">
                {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
              </span>
            }
          />
          {result.rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Nothing to show for these filters.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className={cn("w-full border-collapse text-sm", searching && "opacity-60")}>
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    {result.columns.map((c) => (
                      <th
                        key={c.key}
                        className={cn("border-b px-2.5 py-2 font-medium whitespace-nowrap text-muted-foreground", align(c), c.key === first && "sticky left-0 z-20 bg-muted")}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                      {result.columns.map((c) => {
                        const text = cell(c, row[c.key]);
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "px-2.5 py-1.5 whitespace-nowrap tabular-nums",
                              align(c),
                              c.key === first && "sticky left-0 bg-card font-medium",
                              c.type === "code" && (CODE_TONES[text] ?? (text ? "text-primary" : "")),
                            )}
                          >
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {result.totals && (
                  <tfoot className="sticky bottom-0 bg-muted font-semibold">
                    <tr>
                      {result.columns.map((c) => (
                        <td key={c.key} className={cn("border-t px-2.5 py-2 whitespace-nowrap tabular-nums", align(c), c.key === first && "sticky left-0 bg-muted")}>
                          {cell(c, result.totals![c.key] ?? null)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
