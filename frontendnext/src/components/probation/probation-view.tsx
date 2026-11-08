"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlarmClock, CalendarPlus, CheckCircle2, History, Hourglass, MessageSquarePlus, Plus, Search, UserCheck, UserX } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { PersonAvatar } from "@/components/common/person-avatar";
import { SelectField } from "@/components/common/select-field";
import { StatTile } from "@/components/common/stat-tile";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate, fmtDateTime, isoDate } from "@/lib/format";
import { PROBATION_STATUS_LABELS, probationService, type ProbationEvent, type ProbationPerson } from "@/lib/services/probation";
import { cn } from "@/lib/utils";
import { useEmployeesStore } from "@/stores/employees-store";

type Data = Awaited<ReturnType<typeof probationService.list>>;
type Action = "confirm" | "extend" | "not_confirmed" | "note" | "history";
const DAY = 86400000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

// Joining → end, with today marked
function Timeline({ p, today }: { p: ProbationPerson; today: string }) {
  const end = p.probation_end_date;
  if (!end) return null;
  const total = Math.max(1, days(p.join_date, end));
  const done = Math.min(1, Math.max(0, days(p.join_date, today) / total));
  const left = days(today, end);
  const decided = p.probation_status === "confirmed" || p.probation_status === "not_confirmed";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-2 rounded-full bg-muted">
        <div className={cn("h-full rounded-full", decided ? "bg-muted-foreground/40" : left < 0 ? "bg-destructive" : left <= 30 ? "bg-warning" : "bg-success")} style={{ width: `${(decided ? 1 : done) * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Joined {fmtDate(p.join_date)}</span>
        <span>Ends {fmtDate(end)}</span>
      </div>
    </div>
  );
}

function DaysChip({ p, today }: { p: ProbationPerson; today: string }) {
  if (p.probation_status === "confirmed") return <StatusBadge tone="success">Confirmed {fmtDate(p.confirmed_on)}</StatusBadge>;
  if (p.probation_status === "not_confirmed") return <StatusBadge tone="danger">Not confirmed</StatusBadge>;
  if (p.status === "exited") return <StatusBadge tone="neutral">Left the company</StatusBadge>;
  if (!p.probation_end_date) return null;
  const left = days(today, p.probation_end_date);
  if (left < 0) return <StatusBadge tone="danger">Overdue by {-left} day{left === -1 ? "" : "s"}</StatusBadge>;
  return <StatusBadge tone={left <= 30 ? "warning" : "info"}>{left === 0 ? "Ends today" : `${left} day${left === 1 ? "" : "s"} left`}</StatusBadge>;
}

const ACTION_LABEL: Record<ProbationEvent["action"], string> = { started: "Probation started", extended: "Extended", confirmed: "Confirmed", not_confirmed: "Not confirmed", note: "Note" };

// Confirm / extend / not confirm / note / history for one person
function ActionDialog({ person, action, today, onClose, onDone }: { person: ProbationPerson | null; action: Action | null; today: string; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [startExit, setStartExit] = useState(false);
  const [lastDay, setLastDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ProbationEvent[] | null>(null);
  const open = Boolean(person && action);

  useEffect(() => {
    if (!person || action !== "history") return;
    let cancelled = false;
    run(() => probationService.history(person.id)).then((r) => !cancelled && setHistory(r.ok ? r.data : []));
    return () => {
      cancelled = true;
    };
  }, [person, action]);

  function close() {
    setDate("");
    setNotes("");
    setStartExit(false);
    setLastDay("");
    setHistory(null);
    onClose();
  }

  async function save() {
    if (!person || !action) return;
    setBusy(true);
    const id = person.id;
    const call =
      action === "confirm" ? () => probationService.confirm(id, { confirmedOn: date || today, notes: notes || undefined })
      : action === "extend" ? () => probationService.extend(id, { newEnd: date, notes })
      : action === "not_confirmed" ? () => probationService.notConfirm(id, { notes, lastWorkingDay: startExit ? lastDay : undefined })
      : () => probationService.note(id, notes);
    const r = await run(call, { success: action === "confirm" ? `${person.name} confirmed` : action === "extend" ? "Probation extended" : action === "not_confirmed" ? "Saved" : "Note added" });
    setBusy(false);
    if (!r.ok) return;
    close();
    onDone();
  }

  const title = { confirm: "Confirm", extend: "Extend probation", not_confirmed: "Don't confirm", note: "Add a note", history: "Probation history" }[action ?? "note"];
  const canSave = action === "confirm" || (action === "extend" ? Boolean(date) && notes.trim().length >= 3 : notes.trim().length >= 3 && (!startExit || Boolean(lastDay)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {title} · {person?.name}
          </DialogTitle>
          <DialogDescription>
            {person?.designation ?? "—"} · probation ends {fmtDate(person?.probation_end_date)}
          </DialogDescription>
        </DialogHeader>
        {action === "history" ? (
          !history ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{ACTION_LABEL[h.action]}</span>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)}</span>
                  </div>
                  {(h.old_end || h.new_end) && (
                    <p className="text-xs text-muted-foreground">
                      {h.old_end ? `${fmtDate(h.old_end)} → ` : "Until "}
                      {fmtDate(h.new_end)}
                    </p>
                  )}
                  {h.notes && <p className="mt-1 whitespace-pre-wrap">{h.notes}</p>}
                  {h.by && <p className="mt-1 text-xs text-muted-foreground">by {h.by}</p>}
                </li>
              ))}
            </ol>
          )
        ) : (
          <FormGrid density="dialog">
            {action === "confirm" && (
              <FormField label="Confirmed from" htmlFor="pb-date" span="full">
                <DatePicker id="pb-date" value={date || today} onChange={setDate} />
              </FormField>
            )}
            {action === "extend" && (
              <>
                <FormField label="New end date" htmlFor="pb-date" required span="full">
                  <DatePicker id="pb-date" value={date} onChange={setDate} min={person?.probation_end_date ?? today} />
                </FormField>
                <div className="col-span-12 -mt-2 flex gap-2">
                  {[1, 2, 3].map((m) => (
                    <Button key={m} type="button" size="sm" variant="outline" onClick={() => person?.probation_end_date && setDate(addMonths(person.probation_end_date, m))}>
                      +{m} month{m > 1 ? "s" : ""}
                    </Button>
                  ))}
                </div>
              </>
            )}
            <FormField label={action === "confirm" ? "Notes (optional)" : "Reason"} htmlFor="pb-notes" required={action !== "confirm"} span="full">
              <Textarea id="pb-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={action === "extend" ? "What needs to improve before confirmation…" : undefined} />
            </FormField>
            {action === "not_confirmed" && (
              <>
                <label className="col-span-12 flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={startExit} onCheckedChange={(v) => setStartExit(v === true)} />
                  Start their exit now
                </label>
                {startExit && (
                  <FormField label="Last working day" htmlFor="pb-last" required span="full">
                    <DatePicker id="pb-last" value={lastDay} onChange={setLastDay} />
                  </FormField>
                )}
              </>
            )}
          </FormGrid>
        )}
        {action !== "history" && (
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button variant={action === "not_confirmed" ? "destructive" : "default"} onClick={save} disabled={busy || !canSave}>
              {busy && <Spinner />} {action === "confirm" ? "Confirm" : action === "extend" ? "Extend" : "Save"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Put someone (without a probation) on one
function StartDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [employeeId, setEmployeeId] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) loadEmployees();
  }, [open, loadEmployees]);

  const choices = employees.filter((e) => e.status !== "exited" && !["on_probation", "extended"].includes(e.probation_status ?? ""));
  const picked = employees.find((e) => String(e.id) === employeeId);

  async function save() {
    setBusy(true);
    const r = await run(() => probationService.start({ employeeId: Number(employeeId), endDate }), { success: "Probation started" });
    setBusy(false);
    if (!r.ok) return;
    setEmployeeId("");
    setEndDate("");
    onClose();
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start probation</DialogTitle>
          <DialogDescription>New joiners with a probation end date in their profile are tracked automatically.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Employee" htmlFor="ps-emp" required span="full">
            <SelectField id="ps-emp" value={employeeId} onValueChange={setEmployeeId} placeholder="Pick an employee" options={choices.map((e) => ({ value: String(e.id), label: `${e.name}${e.join_date ? ` · joined ${fmtDate(e.join_date)}` : ""}` }))} />
          </FormField>
          <FormField label="Probation ends" htmlFor="ps-end" required span="full">
            <DatePicker id="ps-end" value={endDate} onChange={setEndDate} min={picked?.join_date ?? undefined} />
          </FormField>
          {picked?.join_date && (
            <div className="col-span-12 -mt-2 flex gap-2">
              {[3, 6].map((m) => (
                <Button key={m} type="button" size="sm" variant="outline" onClick={() => setEndDate(addMonths(picked.join_date!, m))}>
                  {m} months from joining
                </Button>
              ))}
            </div>
          )}
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !employeeId || !endDate}>
            {busy && <Spinner />} Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProbationView() {
  const url = useUrlParams();
  const tab = url.get("tab", "active");
  const page = url.getNumber("page", 1);
  const limit = url.getNumber("limit", 10);
  const search = url.get("search");
  const [typed, setTyped] = useState(search);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<{ person: ProbationPerson; action: Action } | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await run(() => probationService.list({ page, limit, tab, search: search || undefined }));
    setLoading(false);
    if (r.ok) setData(r.data);
  }, [page, limit, tab, search]);

  useEffect(() => {
    let cancelled = false;
    run(() => probationService.list({ page, limit, tab, search: search || undefined })).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [page, limit, tab, search]);

  useEffect(() => {
    const t = setTimeout(() => typed.trim() !== search && url.set({ search: typed.trim(), page: null }), 350);
    return () => clearTimeout(t);
  }, [typed, search, url]);

  const s = data?.stats;
  const goTab = (t: string) => url.set({ tab: t === "active" ? null : t, page: null });
  const today = data?.today ?? isoDate(new Date());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Probation"
        description="Everyone on probation, how long is left, and the decision when it ends."
        className="mb-0"
        actions={
          <Button onClick={() => setStarting(true)}>
            <Plus /> Start probation
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Hourglass} value={s?.active ?? "—"} label="On probation" active={tab === "active"} onClick={() => goTab("active")} />
        <StatTile icon={AlarmClock} value={s?.due ?? "—"} label="Ending in 30 days" tone="bg-warning/15 text-warning" active={tab === "due"} onClick={() => goTab("due")} />
        <StatTile icon={UserX} value={s?.overdue ?? "—"} label="Past the end date" tone="bg-destructive/10 text-destructive" active={tab === "overdue"} onClick={() => goTab("overdue")} />
        <StatTile icon={UserCheck} value={s?.confirmed ?? "—"} label="Confirmed this year" tone="bg-success/15 text-success" active={tab === "decided"} onClick={() => goTab("decided")} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onValueChange={goTab}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="due">Due soon</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="decided">Decided</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or code…" value={typed} onChange={(e) => setTyped(e.target.value)} className="pl-8" aria-label="Search" />
        </div>
      </div>

      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.total === 0 ? (
        <EmptyState icon={Hourglass} title={tab === "overdue" ? "Nobody is past their end date" : tab === "due" ? "No probation ends in the next 30 days" : "Nobody here"} description="Set a probation end date on a new joiner, or start one here." />
      ) : (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")}>
          {data.people.map((p) => {
            const active = p.status !== "exited" && (p.probation_status === "on_probation" || p.probation_status === "extended");
            return (
              <article key={p.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <PersonAvatar name={p.name} photoUrl={p.photo_url} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/employees/${p.id}`} className="font-semibold hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.designation, p.department, p.manager_name && `reports to ${p.manager_name}`].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.probation_status && <StatusBadge tone={p.probation_status === "extended" ? "warning" : "neutral"}>{PROBATION_STATUS_LABELS[p.probation_status]}{p.extensions ? ` ×${p.extensions}` : ""}</StatusBadge>}
                    <DaysChip p={p} today={today} />
                  </div>
                </div>
                <div className="mt-3">
                  <Timeline p={p} today={today} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {active && (
                    <>
                      <Button size="sm" onClick={() => setActing({ person: p, action: "confirm" })}>
                        <CheckCircle2 /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActing({ person: p, action: "extend" })}>
                        <CalendarPlus /> Extend
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setActing({ person: p, action: "not_confirmed" })}>
                        <UserX /> Don&apos;t confirm
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setActing({ person: p, action: "note" })}>
                    <MessageSquarePlus /> Note
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActing({ person: p, action: "history" })}>
                    <History /> History
                  </Button>
                </div>
              </article>
            );
          })}
          <div className="rounded-xl border bg-card">
            <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={(p) => url.set({ page: p === 1 ? null : p })} onLimitChange={(l) => url.set({ limit: l === 10 ? null : l, page: null })} />
          </div>
        </div>
      )}

      <ActionDialog person={acting?.person ?? null} action={acting?.action ?? null} today={today} onClose={() => setActing(null)} onDone={load} />
      <StartDialog open={starting} onClose={() => setStarting(false)} onDone={load} />
    </div>
  );
}
