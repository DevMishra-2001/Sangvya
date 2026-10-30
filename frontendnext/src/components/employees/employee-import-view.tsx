"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileCheck2, FileSpreadsheet, Sheet, Upload, Users } from "lucide-react";
import { ConfirmAction } from "@/components/common/confirm-button";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { employeesService } from "@/lib/services/employees";
import type { EmployeeImportCheck, EmployeeImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";

const MAX_BYTES = 2 * 1024 * 1024;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Import employees: template → upload → check every row → import the ready ones
export function EmployeeImportView() {
  const canManage = useCan()("employees.manage");
  const reload = useEmployeesStore((s) => s.load);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [check, setCheck] = useState<EmployeeImportCheck | null>(null);
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<"check" | "import" | "xlsx" | "csv" | null>(null);

  function pick(f: File | null) {
    setCheck(null);
    setFileError(undefined);
    if (f && !/\.(csv|xlsx)$/i.test(f.name)) setFileError("Choose a .csv or .xlsx file");
    else if (f && f.size > MAX_BYTES) setFileError("The file is larger than 2 MB");
    setFile(f);
  }

  async function runCheck() {
    if (!file || fileError) return setFileError(fileError ?? "Choose a file");
    setBusy("check");
    const r = await run(() => employeesService.checkImport(file));
    setBusy(null);
    if (r.ok) {
      setCheck(r.data);
      setFilter(r.data.summary.invalid ? "errors" : "all");
    }
  }

  async function runImport() {
    if (!file) return;
    setBusy("import");
    const r = await run(() => employeesService.runImport(file), { success: (d) => `Imported ${plural(d.imported, "employee")}` });
    setBusy(null);
    if (r.ok) {
      setResult(r.data);
      reload();
    }
  }

  async function template(format: "xlsx" | "csv") {
    setBusy(format);
    await run(() => employeesService.importTemplate(format), { error: "Couldn't download the template" });
    setBusy(null);
  }

  function reset() {
    setFile(null);
    setCheck(null);
    setResult(null);
    if (input.current) input.current.value = "";
  }

  const back = (
    <Button variant="outline" asChild>
      <Link href="/employees">
        <ArrowLeft /> Employees
      </Link>
    </Button>
  );

  if (!canManage) return <p className="text-sm text-muted-foreground">You don&apos;t have permission to import employees.</p>;

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Import employees" className="mb-0" actions={back} />
        <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <h2 className="text-lg font-semibold">Imported {plural(result.imported, "employee")}</h2>
          <p className="text-sm text-muted-foreground">
            {result.logins > 0 && `${plural(result.logins, "login")} created — they set their own password at first login. `}
            {result.skipped > 0 && `${plural(result.skipped, "row")} with errors skipped.`}
          </p>
          {result.loginFailures.length > 0 && (
            <ul className="text-sm text-destructive">
              {result.loginFailures.map((f) => (
                <li key={f.line}>
                  Row {f.line} · {f.name}: login not created — {f.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <Button asChild>
              <Link href="/employees">
                <Users /> View employees
              </Link>
            </Button>
            <Button variant="outline" onClick={reset}>
              <Upload /> Import another file
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const rows = (check?.rows ?? []).filter((r) => (filter === "errors" ? r.errors.length > 0 : filter === "ready" ? r.errors.length === 0 : true));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader title="Import employees" description="Add many employees at once from a CSV or Excel file. Every row is checked before anything is saved." className="mb-0" actions={back} />

      <FormCard title="Upload file" crumbs={["Employees", "Import"]} icon={Upload}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            runCheck();
          }}
        >
          <FormGrid>
            <FormField label="File (.csv or .xlsx)" htmlFor="import-file" error={fileError ? { message: fileError } : undefined} float={false} span="md">
              <Input id="import-file" ref={input} type="file" accept=".csv,.xlsx" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-invalid={Boolean(fileError)} />
            </FormField>
            <FormActions span="md" className="flex-wrap self-end">
              <Button type="submit" disabled={busy !== null}>
                {busy === "check" ? <Spinner /> : <FileCheck2 />} Check file
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => template("xlsx")}>
                {busy === "xlsx" ? <Spinner /> : <FileSpreadsheet />} Excel template
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => template("csv")}>
                {busy === "csv" ? <Spinner /> : <Sheet />} CSV template
              </Button>
            </FormActions>
          </FormGrid>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Only Name is required. Reports to takes the manager&apos;s employee code or email (they can be in the same file). A Temporary password creates a login. Up to 1000 rows, 2 MB.
        </p>
      </FormCard>

      {check && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading
            title={`Check · ${plural(check.summary.total, "row")}`}
            actions={
              <>
                <span className="text-xs font-medium text-success">{check.summary.ready} ready</span>
                {check.summary.invalid > 0 && <span className="text-xs font-medium text-destructive">{check.summary.invalid} with errors</span>}
                <SelectField
                  className="h-8 w-36"
                  value={filter}
                  onValueChange={setFilter}
                  options={[
                    { value: "all", label: "All rows" },
                    { value: "errors", label: "With errors" },
                    { value: "ready", label: "Ready" },
                  ]}
                  aria-label="Show rows"
                />
                <ConfirmAction
                  title={`Import ${plural(check.summary.ready, "employee")}?`}
                  description={check.summary.invalid ? `${plural(check.summary.invalid, "row")} with errors will be skipped — fix them and upload just those rows later.` : "Every row is ready."}
                  confirmLabel="Import"
                  onConfirm={runImport}
                >
                  <Button size="sm" disabled={busy !== null || check.summary.ready === 0}>
                    {busy === "import" ? <Spinner /> : <Upload />} Import {check.summary.ready}
                  </Button>
                </ConfirmAction>
              </>
            }
          />
          {check.ignoredColumns.length > 0 && (
            <p className="border-b bg-warning/10 px-4 py-2 text-xs text-warning">Ignored columns (not in the template): {check.ignoredColumns.join(", ")}</p>
          )}
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="text-left text-muted-foreground">
                  {["Row", "Name", "Code", "Email", "Designation", "Department", "Reports to", "Login", "Result"].map((h) => (
                    <th key={h} className="border-b px-2.5 py-2 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={cn("border-b align-top last:border-0", r.errors.length > 0 && "bg-destructive/5")}>
                    <td className="px-2.5 py-1.5 text-muted-foreground tabular-nums">{r.line}</td>
                    <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">{r.name || "—"}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.code || "—"}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.email || "—"}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.designation || "—"}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.department || "—"}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{r.manager || "—"}</td>
                    <td className="px-2.5 py-1.5">{r.login ? "Yes" : "—"}</td>
                    <td className="min-w-64 px-2.5 py-1.5">
                      {r.errors.length > 0 ? (
                        <ul className="list-disc pl-4 text-destructive">
                          {r.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="font-medium text-success">Ready</span>
                      )}
                      {r.notes.map((n) => (
                        <p key={n} className="text-xs text-muted-foreground">
                          {n}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No rows to show.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
