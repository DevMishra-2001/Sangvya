"use client";

// View Expense: own, team or all expenses and advances for a month — approve, pay, export, print
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, FileSpreadsheet, Printer, Receipt, Search } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormCard, FormGrid } from "@/components/common/form-layout";
import { MonthPicker } from "@/components/common/month-picker";
import { Pagination } from "@/components/common/pagination";
import { SelectField } from "@/components/common/select-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate, toMonth } from "@/lib/format";
import { branchesService } from "@/lib/services/branches";
import { expensesService, type ExpenseFilters, type ExpenseRow } from "@/lib/services/expenses";
import type { Branch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan, useUser } from "@/stores/auth-store";
import { useDepartmentsStore } from "@/stores/departments-store";
import { BalanceStrip, STATUS } from "./expense-shared";
import { ExpenseDetailSheet } from "./expense-detail-sheet";

type Data = Awaited<ReturnType<typeof expensesService.list>>;
const money = (n: number) => (n ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });

// Round letter buttons: V view, A approve, R reject, P pay, D delete
function Act({ letter, label, tone, onClick, disabled }: { letter: string; label: string; tone: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white disabled:opacity-30", tone)}>
          {letter}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ViewExpenseView() {
  const user = useUser();
  const canManage = useCan()("expense.manage");
  const departments = useDepartmentsStore((s) => s.list);
  const loadDepartments = useDepartmentsStore((s) => s.load);
  const url = useUrlParams();
  // Applied filters live in the URL; the form edits a copy until "Search"
  const applied: ExpenseFilters = {
    scope: url.get("scope", "mine"),
    month: url.get("month", toMonth(new Date())),
    kind: url.get("kind", "both"),
    status: url.get("status") || undefined,
    employeeId: url.getNumber("employee", 0) || undefined,
    departmentId: url.getNumber("department", 0) || undefined,
    branchId: url.getNumber("branch", 0) || undefined,
    page: url.getNumber("page", 1),
    limit: url.getNumber("limit", 20),
  };
  const key = JSON.stringify(applied);
  const [form, setForm] = useState(applied);
  const [people, setPeople] = useState<{ id: number; name: string }[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ kind: "claim" | "advance"; id: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const isLead = canManage || people.length > 0;

  // Lists for the filters, once
  useEffect(() => {
    let cancelled = false;
    loadDepartments();
    run(() => expensesService.people(), { silent: true }).then((r) => !cancelled && r.ok && setPeople(r.data.filter((p) => p.id !== user.employee_id)));
    run(() => branchesService.list(), { silent: true }).then((r) => !cancelled && r.ok && setBranches(r.data));
    return () => {
      cancelled = true;
    };
  }, [loadDepartments, user.employee_id]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    run(() => expensesService.list(JSON.parse(key) as ExpenseFilters)).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  if (!user.employee_id && !canManage) return <NotLinkedState />;

  function search() {
    url.set({
      scope: form.scope === "mine" ? null : form.scope,
      month: form.month,
      kind: form.kind === "both" ? null : form.kind,
      status: form.status || null,
      employee: form.employeeId ?? null,
      department: form.departmentId ?? null,
      branch: form.branchId ?? null,
      page: null,
    });
  }

  async function quickApprove(r: ExpenseRow) {
    const ok = (await run((): Promise<unknown> => (r.kind === "claim" ? expensesService.decideClaim(r.id, { action: "approve" }) : expensesService.decideAdvance(r.id, { action: "approve" })), { success: "Approved" })).ok;
    if (ok) setVersion((v) => v + 1);
  }

  const set = (k: keyof ExpenseFilters) => (v: string) => setForm((f) => ({ ...f, [k]: v === "" ? undefined : ["employeeId", "departmentId", "branchId"].includes(k) ? Number(v) : v }));

  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title="View Expense"
       
        icon={Receipt}
        actions={
          <Button asChild size="sm">
            <Link href="/expenses/new">
              <ArrowRight /> Expense Submission
            </Link>
          </Button>
        }
        bodyClassName="flex flex-col gap-3"
      >
        <BalanceStrip employeeId={applied.employeeId} month={applied.month} className="border-dashed" />
        <FormGrid>
          {isLead && (
            <FormField label="Show" htmlFor="ve-scope">
              <SelectField
                id="ve-scope"
                value={form.scope ?? "mine"}
                onValueChange={set("scope")}
                options={[
                  { value: "mine", label: "My expenses" },
                  { value: "team", label: canManage ? "Everyone else" : "My team" },
                  ...(canManage ? [{ value: "all", label: "All (incl. mine)" }] : []),
                ]}
              />
            </FormField>
          )}
          {isLead && form.scope !== "mine" && (
            <FormField label="Employee" htmlFor="ve-emp">
              <SelectField id="ve-emp" value={form.employeeId ? String(form.employeeId) : ""} onValueChange={set("employeeId")} emptyLabel="Everyone" options={people.map((p) => ({ value: String(p.id), label: p.name }))} />
            </FormField>
          )}
          <FormField label="Month" htmlFor="ve-month">
            <MonthPicker id="ve-month" value={form.month ?? ""} onChange={set("month")} />
          </FormField>
          {isLead && form.scope !== "mine" && (
            <>
              <FormField label="Department" htmlFor="ve-dept">
                <SelectField id="ve-dept" value={form.departmentId ? String(form.departmentId) : ""} onValueChange={set("departmentId")} emptyLabel="All departments" options={departments.map((d) => ({ value: String(d.id), label: d.name }))} />
              </FormField>
              {branches.length > 0 && (
                <FormField label="Branch" htmlFor="ve-branch">
                  <SelectField id="ve-branch" value={form.branchId ? String(form.branchId) : ""} onValueChange={set("branchId")} emptyLabel="All branches" options={branches.map((b) => ({ value: String(b.id), label: b.name }))} />
                </FormField>
              )}
            </>
          )}
          <FormField label="ExpenseType" htmlFor="ve-kind">
            <SelectField
              id="ve-kind"
              value={form.kind ?? "both"}
              onValueChange={set("kind")}
              options={[
                { value: "both", label: "BOTH" },
                { value: "claims", label: "Expenses" },
                { value: "advances", label: "Advances" },
              ]}
            />
          </FormField>
          <FormField label="StatusType" htmlFor="ve-status">
            <SelectField id="ve-status" value={form.status ?? ""} onValueChange={set("status")} emptyLabel="All" options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} />
          </FormField>
          <div className="col-span-12 flex items-end gap-2 md:col-span-4">
            <Button onClick={search}>
              <Search /> Search
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Export to Excel"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                await run(() => expensesService.exportExcel(applied));
                setExporting(false);
              }}
            >
              {exporting ? <Spinner /> : <FileSpreadsheet className="text-success" />}
            </Button>
          </div>
        </FormGrid>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-primary/5 px-3 py-1.5 text-[13px]">
          <span className="font-semibold">Search Details</span>
          <span className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">V</span> View
            </span>
            <span className="flex items-center gap-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">A</span> Approve
            </span>
            <span className="flex items-center gap-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">R</span> Reject
            </span>
            <span className="flex items-center gap-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">S</span> Submit
            </span>
            <span className="flex items-center gap-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">P</span> Pay
            </span>
            <span className="flex items-center gap-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white">D</span> Delete
            </span>
          </span>
          <span className="ml-auto font-semibold">Grand Total : {money(data?.grandTotal ?? 0)}</span>
          <span className="font-semibold">Total Record : {data?.total ?? 0}</span>
        </div>
        {!data ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : !data.rows.length ? (
          <EmptyState icon={Receipt} title="Nothing for these filters" description="Change the month or filters and press Search." />
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
            <Table className="border-collapse [&_td]:border [&_th]:border">
              <TableHeader>
                <TableRow className="text-primary">
                  <TableHead>S.No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>TripName</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Hotel</TableHead>
                  <TableHead className="text-right">Meals</TableHead>
                  <TableHead className="text-right">Local</TableHead>
                  <TableHead className="text-right">InterCity</TableHead>
                  <TableHead className="text-right">Entertainment</TableHead>
                  <TableHead className="text-right">Others</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Attachment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r, i) => (
                  <TableRow key={`${r.kind}-${r.id}`}>
                    <TableCell>{(data.page - 1) * data.limit + i + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap uppercase">{r.employee_name}</TableCell>
                    <TableCell className="max-w-64">
                      <button type="button" onClick={() => setOpen({ kind: r.kind, id: r.id })} className="flex items-center gap-1.5 text-left hover:text-primary">
                        <Eye className="size-3.5 shrink-0" />
                        <span className="truncate">{r.title}</span>
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                    <TableCell>{day(r.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.hotel)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.meals)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.local)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.intercity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.entertainment)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.others)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{money(r.total)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <span className="flex gap-1">
                        <Act letter="V" label="View" tone="bg-primary" onClick={() => setOpen({ kind: r.kind, id: r.id })} />
                        {r.can_decide && <Act letter="A" label="Approve" tone="bg-success" onClick={() => quickApprove(r)} />}
                        {r.can_decide && <Act letter="R" label="Reject (add a note)" tone="bg-destructive" onClick={() => setOpen({ kind: r.kind, id: r.id })} />}
                        {r.kind === "claim" && r.status === "draft" && r.employee_id === user.employee_id && (
                          <Link href={`/expenses/new?id=${r.id}`} aria-label="Submit" className="flex size-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                            S
                          </Link>
                        )}
                        {r.can_pay && <Act letter="P" label="Record payment" tone="bg-violet-500" onClick={() => setOpen({ kind: r.kind, id: r.id })} />}
                        {r.can_delete && (
                          <Act
                            letter="D"
                            label="Delete"
                            tone="bg-pink-500"
                            onClick={async () => window.confirm(`Delete "${r.title}"?`) && (await run(() => expensesService.deleteClaim(r.id), { success: "Deleted" })).ok && setVersion((v) => v + 1)}
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.kind === "claim" ? (
                        <Button variant="ghost" size="icon-sm" aria-label="Print voucher" onClick={() => run(() => expensesService.claimPdf(r.id))}>
                          <Printer />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.files ? `${r.files} file${r.files === 1 ? "" : "s"}` : "—"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.total > 0 && (
          <Pagination
            className="border-t"
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={(p) => url.set({ page: p === 1 ? null : p })}
            onLimitChange={(l) => url.set({ limit: l === 20 ? null : l, page: null })}
          />
        )}
      </section>

      <ExpenseDetailSheet target={open} onClose={() => setOpen(null)} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
