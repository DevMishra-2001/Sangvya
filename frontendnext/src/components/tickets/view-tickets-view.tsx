"use client";

// View Tickets: filters, status chips with counts, the ticket table, Excel, and the ticket panel (?id=)
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Eye, FileSpreadsheet, LayoutList, Plus, RotateCcw, Search } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormCard, FormGrid } from "@/components/common/form-layout";
import { MultiSelect } from "@/components/common/multi-select";
import { Pagination } from "@/components/common/pagination";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDateTime } from "@/lib/format";
import { ticketsService, type TicketFilters, type TicketList } from "@/lib/services/tickets";
import { cn } from "@/lib/utils";
import { useTicketMeta } from "@/stores/ticket-meta-store";
import { ColorBadge, DueChip, mins } from "./ticket-shared";
import { TicketSheet } from "./ticket-sheet";

const KEYS = ["scope", "q", "projectId", "categoryId", "priorityId", "assignedTo", "view", "createdFrom", "createdTo", "dueFrom", "dueTo"] as const;
const list = (v: string | undefined) => (v ? v.split(",").filter(Boolean) : []);

export function ViewTicketsView() {
  const url = useUrlParams();
  const meta = useTicketMeta((s) => s.meta);
  const loadMeta = useTicketMeta((s) => s.load);

  // Applied filters live in the URL; the form edits a copy until "Search"
  const applied: TicketFilters = {
    scope: (url.get("scope") || "mine") as TicketFilters["scope"],
    q: url.get("q") || undefined,
    projectId: url.get("projectId") || undefined,
    categoryId: url.get("categoryId") || undefined,
    priorityId: url.get("priorityId") || undefined,
    assignedTo: url.get("assignedTo") || undefined,
    statusId: url.get("statusId") || undefined,
    view: (url.get("view") || "all") as TicketFilters["view"],
    createdFrom: url.get("createdFrom") || undefined,
    createdTo: url.get("createdTo") || undefined,
    dueFrom: url.get("dueFrom") || undefined,
    dueTo: url.get("dueTo") || undefined,
    sort: (url.get("sort") || "created") as TicketFilters["sort"],
    order: (url.get("order") || "desc") as TicketFilters["order"],
    page: url.getNumber("page", 1),
    limit: url.getNumber("limit", 20),
  };
  const key = JSON.stringify(applied);
  const openId = url.getNumber("id", 0) || null;
  const [form, setForm] = useState(applied);
  const [formKey, setFormKey] = useState(key);
  const [data, setData] = useState<TicketList | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Back / forward or a chip click: the form follows the URL
  if (formKey !== key) {
    setFormKey(key);
    setForm(applied);
  }

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    run(() => ticketsService.list(JSON.parse(key) as TicketFilters)).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const closeSheet = useCallback(() => url.set({ id: null }), [url]);

  function search() {
    const next: Record<string, string | null> = { page: null };
    for (const k of KEYS) next[k] = (form[k] as string | undefined) || null;
    if (next.scope === "mine") next.scope = null;
    if (next.view === "all") next.view = null;
    url.set(next);
  }
  function reset() {
    const next: Record<string, null> = { page: null, statusId: null };
    for (const k of KEYS) next[k] = null;
    url.set(next);
  }
  const set = (k: keyof TicketFilters) => (v: string) => setForm((f) => ({ ...f, [k]: v || undefined }));
  const setList = (k: keyof TicketFilters) => (v: string[]) => setForm((f) => ({ ...f, [k]: v.join(",") || undefined }));
  const sortBy = (s: NonNullable<TicketFilters["sort"]>) => url.set({ sort: s === "created" ? null : s, order: applied.sort === s && applied.order === "desc" ? "asc" : null, page: null });

  if (!meta) return <Skeleton className="h-96 rounded-xl" />;
  const statusFilter = list(applied.statusId);
  const toggleStatus = (id: string) => {
    const next = statusFilter.includes(id) ? statusFilter.filter((x) => x !== id) : [...statusFilter, id];
    url.set({ statusId: next.join(",") || null, page: null });
  };
  const scopes = [
    { value: "mine", label: "Assigned to me" },
    { value: "created", label: "Raised by me" },
    ...(meta.can.seeTeam ? [{ value: "team", label: "My team" }] : []),
    { value: "all", label: meta.can.seeAll ? "All tickets" : "Everything I can see" },
  ];
  const opts = <T extends { id: number; name: string }>(rows: T[]) => rows.map((r) => ({ value: String(r.id), label: r.name }));
  const total = Object.values(data?.statusCounts ?? {}).reduce((a, b) => a + b, 0);
  const head = (label: string, s?: NonNullable<TicketFilters["sort"]>, className?: string) => (
    <TableHead className={className}>
      {s ? (
        <button type="button" onClick={() => sortBy(s)} className="inline-flex items-center gap-1 hover:text-primary">
          {label}
          {applied.sort === s && <span className="text-2xs">{applied.order === "asc" ? "▲" : "▼"}</span>}
        </button>
      ) : (
        label
      )}
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title="View Tickets"
        icon={LayoutList}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={exporting || !data?.total}
              onClick={async () => {
                setExporting(true);
                await run(() => ticketsService.exportExcel({ ...applied, page: undefined, limit: undefined }));
                setExporting(false);
              }}
            >
              {exporting ? <Spinner /> : <FileSpreadsheet />} Excel
            </Button>
            {meta.can.create && (
              <Button size="sm" asChild>
                <Link href="/tickets/new">
                  <Plus /> New Ticket
                </Link>
              </Button>
            )}
          </>
        }
      >
        <FormGrid>
          <FormField label="Show" htmlFor="f-scope">
            <SelectField id="f-scope" value={form.scope ?? "mine"} onValueChange={set("scope")} options={scopes} />
          </FormField>
          <FormField label="Project" htmlFor="f-project">
            <MultiSelect id="f-project" value={list(form.projectId)} onChange={setList("projectId")} options={opts(meta.projects)} placeholder="All" />
          </FormField>
          <FormField label="Category" htmlFor="f-category">
            <MultiSelect id="f-category" value={list(form.categoryId)} onChange={setList("categoryId")} options={opts(meta.categories)} placeholder="All" />
          </FormField>
          <FormField label="Priority" htmlFor="f-priority">
            <MultiSelect id="f-priority" value={list(form.priorityId)} onChange={setList("priorityId")} options={opts(meta.priorities)} placeholder="All" />
          </FormField>
          {(meta.can.seeAll || meta.can.seeTeam) && (
            <FormField label="Assigned to" htmlFor="f-assignee">
              <MultiSelect id="f-assignee" value={list(form.assignedTo)} onChange={setList("assignedTo")} options={opts(meta.people)} placeholder="Anyone" />
            </FormField>
          )}
          <FormField label="Which" htmlFor="f-view">
            <SelectField
              id="f-view"
              value={form.view ?? "all"}
              onValueChange={set("view")}
              options={[
                { value: "all", label: "All" },
                { value: "open", label: "Open (not done)" },
                { value: "delayed", label: "Delayed" },
                { value: "finished", label: "Done / closed" },
              ]}
            />
          </FormField>
          <FormField label="Created from" htmlFor="f-cfrom">
            <DatePicker id="f-cfrom" value={form.createdFrom ?? ""} onChange={set("createdFrom")} clearable />
          </FormField>
          <FormField label="Created to" htmlFor="f-cto">
            <DatePicker id="f-cto" value={form.createdTo ?? ""} onChange={set("createdTo")} min={form.createdFrom} clearable />
          </FormField>
          <FormField label="Delivery from" htmlFor="f-dfrom">
            <DatePicker id="f-dfrom" value={form.dueFrom ?? ""} onChange={set("dueFrom")} clearable />
          </FormField>
          <FormField label="Delivery to" htmlFor="f-dto">
            <DatePicker id="f-dto" value={form.dueTo ?? ""} onChange={set("dueTo")} min={form.dueFrom} clearable />
          </FormField>
          <FormField label="Ticket no. / title" htmlFor="f-q">
            <Input id="f-q" value={form.q ?? ""} onChange={(e) => set("q")(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} maxLength={100} />
          </FormField>
          <div className="col-span-12 flex items-start gap-2 sm:col-span-6 lg:col-span-4 xl:col-span-2 [&_[data-slot=button]]:h-9">
            <Button onClick={search}>
              <Search /> Search
            </Button>
            <Button variant="outline" onClick={reset} aria-label="Reset filters">
              <RotateCcw />
            </Button>
          </div>
        </FormGrid>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        {/* Status chips: click to filter */}
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-primary/5 px-3 py-2">
          <button
            type="button"
            onClick={() => url.set({ statusId: null, page: null })}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", statusFilter.length === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
          >
            All <span className="tabular-nums">{total}</span>
          </button>
          {meta.statuses
            .filter((s) => s.is_active || data?.statusCounts[s.id])
            .map((s) => {
              const on = statusFilter.includes(String(s.id));
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStatus(String(s.id))}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors", on ? "text-white" : "bg-background hover:bg-muted")}
                  style={on ? { backgroundColor: s.color, borderColor: s.color } : { borderColor: `${s.color}55` }}
                >
                  {!on && <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />}
                  {s.name} <span className="tabular-nums opacity-80">{data?.statusCounts[s.id] ?? 0}</span>
                </button>
              );
            })}
          <span className="flex-1" />
          {data && (
            <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              {data.delayed > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                  <AlertTriangle className="size-3" /> {data.delayed} delayed
                </span>
              )}
              <span>
                Time spent: <b className="text-foreground">{mins(data.spentMinutes)}</b>
              </span>
              <span>
                Total: <b className="text-foreground">{data.total}</b>
              </span>
            </span>
          )}
        </div>

        {!data ? (
          <Skeleton className="m-3 h-64" />
        ) : data.rows.length === 0 ? (
          <EmptyState icon={LayoutList} title="No tickets found" description="Change the filters, or raise a new ticket." />
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
            <Table className="border-collapse [&_td]:border [&_th]:border">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {head("#", undefined, "w-10")}
                  {head("Ticket", "code")}
                  {head("Project")}
                  {head("Category")}
                  {head("Title", undefined, "min-w-64")}
                  {head("Assigned to")}
                  {head("Priority")}
                  {head("Status")}
                  {head("Delivery", "due")}
                  {head("Spent")}
                  {head("Created", "created")}
                  {head("Updated", "updated")}
                  {head("Action", undefined, "text-center")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((t, i) => (
                  <TableRow key={t.id} className={cn("cursor-pointer", t.delayed && "bg-destructive/[0.04]")} onClick={() => url.set({ id: t.id })}>
                    <TableCell className="text-muted-foreground" style={{ boxShadow: `inset 3px 0 0 ${t.status_color}` }}>
                      {(data.page - 1) * data.limit + i + 1}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-primary">{t.code}</span>
                    </TableCell>
                    <TableCell className="max-w-44">
                      <div className="truncate text-xs">{t.project_name ?? "—"}</div>
                      {t.module_name && <div className="truncate text-2xs text-muted-foreground">{t.module_name}</div>}
                    </TableCell>
                    <TableCell>{t.category_name ? <ColorBadge color={t.category_color}>{t.category_name}</ColorBadge> : "—"}</TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      <span className="line-clamp-2 text-sm">{t.title}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.assigned_to_name ?? <span className="text-muted-foreground">Unassigned</span>}
                      {t.secondary_name && <div className="text-2xs text-muted-foreground">+ {t.secondary_name}</div>}
                    </TableCell>
                    <TableCell>{t.priority_name ? <ColorBadge color={t.priority_color}>{t.priority_name}</ColorBadge> : "—"}</TableCell>
                    <TableCell>
                      <ColorBadge color={t.status_color} dot>
                        {t.status_name}
                      </ColorBadge>
                    </TableCell>
                    <TableCell>
                      <DueChip date={t.due_date} delayed={t.delayed} />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {mins(t.spent_minutes)}
                      {t.estimate_minutes ? <span className="text-muted-foreground"> / {mins(t.estimate_minutes)}</span> : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{t.created_by_name ?? "—"}</div>
                      <div className="text-2xs text-muted-foreground">{fmtDateTime(t.created_at)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{t.updated_by_name ?? "—"}</div>
                      <div className="text-2xs text-muted-foreground">{fmtDateTime(t.updated_at)}</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        <Button variant="ghost" size="icon-sm" aria-label={`Open ${t.code}`} onClick={() => url.set({ id: t.id })}>
                          <Eye />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.total > 0 && (
          <Pagination className="border-t px-3 py-2" page={data.page} limit={data.limit} total={data.total} onPageChange={(p) => url.set({ page: p === 1 ? null : p })} onLimitChange={(l) => url.set({ limit: l === 20 ? null : l, page: null })} />
        )}
      </section>

      <TicketSheet ticketId={openId} onClose={closeSheet} onChanged={refresh} />
    </div>
  );
}
