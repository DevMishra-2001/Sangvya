"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ClipboardCheck, DoorOpen, IndianRupee, Plus, Search, Timer, UserMinus } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { EXIT_REASON_LABELS, EXIT_REASON_OPTIONS } from "@/lib/constants";
import { fmtDate, inr } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import { EXIT_STAGE_LABELS, exitsService, type ExitStage } from "@/lib/services/exits";
import type { ExitReason, Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEmployeesStore } from "@/stores/employees-store";
import { ExitPanel } from "./exit-panel";

type Data = Awaited<ReturnType<typeof exitsService.list>>;
const STAGES: ExitStage[] = ["notice", "clearance", "settlement", "completed"];
const STAGE_TONE: Record<ExitStage, "warning" | "info" | "neutral" | "success"> = { notice: "warning", clearance: "info", settlement: "neutral", completed: "success" };

// Steps: notice → clearance → F&F → done
function Steps({ stage }: { stage: ExitStage }) {
  const at = STAGES.indexOf(stage);
  return (
    <div className="flex items-center gap-1" aria-label={`Stage: ${EXIT_STAGE_LABELS[stage]}`}>
      {STAGES.map((s, i) => (
        <span key={s} className={cn("h-1.5 flex-1 rounded-full", i < at ? "bg-success" : i === at ? (stage === "completed" ? "bg-success" : "bg-primary") : "bg-muted")} title={EXIT_STAGE_LABELS[s]} />
      ))}
    </div>
  );
}

function InitiateDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: Id) => void }) {
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [employeeId, setEmployeeId] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [reason, setReason] = useState<ExitReason>("resigned");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) loadEmployees();
  }, [open, loadEmployees]);

  async function save() {
    setBusy(true);
    const id = Number(employeeId);
    const r = await run(() => employeesService.startExit(id, { lastWorkingDay: lastDay, reason, notes: notes || undefined }), { success: "Exit started" });
    setBusy(false);
    if (!r.ok) return;
    setEmployeeId("");
    setLastDay("");
    setNotes("");
    onClose();
    onDone(id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Initiate exit</DialogTitle>
          <DialogDescription>They serve notice until the last working day; the clearance checklist starts now.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Employee" htmlFor="ie-emp" required span="full">
            <SelectField id="ie-emp" value={employeeId} onValueChange={setEmployeeId} placeholder="Pick an employee" options={employees.filter((e) => e.status === "active").map((e) => ({ value: String(e.id), label: `${e.name}${e.designation ? ` · ${e.designation}` : ""}` }))} />
          </FormField>
          <FormField label="Last working day" htmlFor="ie-last" required span="md">
            <DatePicker id="ie-last" value={lastDay} onChange={setLastDay} />
          </FormField>
          <FormField label="Reason" htmlFor="ie-reason" required span="md">
            <SelectField id="ie-reason" value={reason} onValueChange={(v) => setReason(v as ExitReason)} options={EXIT_REASON_OPTIONS} />
          </FormField>
          <FormField label="Notes" htmlFor="ie-notes" span="full">
            <Textarea id="ie-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !employeeId || !lastDay}>
            {busy && <Spinner />} Start exit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Everyone leaving: where each exit stands, from notice to the final settlement
export function ExitsView() {
  const url = useUrlParams();
  const stage = url.get("stage", "open");
  const page = url.getNumber("page", 1);
  const limit = url.getNumber("limit", 20);
  const search = url.get("search");
  const [typed, setTyped] = useState(search);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<Id | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    run(() => exitsService.list({ page, limit, stage, search: search || undefined })).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [page, limit, stage, search, reloadKey]);

  useEffect(() => {
    const t = setTimeout(() => typed.trim() !== search && url.set({ search: typed.trim(), page: null }), 350);
    return () => clearTimeout(t);
  }, [typed, search, url]);

  const reload = () => setReloadKey((k) => k + 1);
  const s = data?.stats;
  const goStage = (v: string) => url.set({ stage: v === "open" ? null : v, page: null });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Exits"
        description="Notice periods, clearance, full & final settlement and exit interviews."
        className="mb-0"
        actions={
          <Button onClick={() => setInitiating(true)}>
            <Plus /> Initiate exit
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={CalendarClock} value={s?.notice ?? "—"} label="Serving notice" tone="bg-warning/15 text-warning" active={stage === "notice"} onClick={() => goStage("notice")} />
        <StatTile icon={ClipboardCheck} value={s?.clearance ?? "—"} label="Clearance pending" tone="bg-info/15 text-info" active={stage === "clearance"} onClick={() => goStage("clearance")} />
        <StatTile icon={IndianRupee} value={s?.settlement ?? "—"} label="F&F pending" active={stage === "settlement"} onClick={() => goStage("settlement")} />
        <StatTile icon={DoorOpen} value={s?.completedThisMonth ?? "—"} label="Left this month" tone="bg-success/15 text-success" active={stage === "completed"} onClick={() => goStage("completed")} />
        <StatTile icon={Timer} value={s ? `${s.avgNoticeDays}d` : "—"} label="Average notice" tone="bg-violet-500/12 text-violet-600 dark:text-violet-400" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={stage} onValueChange={goStage}>
          <TabsList>
            <TabsTrigger value="open">In progress</TabsTrigger>
            <TabsTrigger value="notice">Notice</TabsTrigger>
            <TabsTrigger value="clearance">Clearance</TabsTrigger>
            <TabsTrigger value="settlement">F&amp;F</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
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
        <EmptyState icon={UserMinus} title={stage === "open" ? "Nobody is leaving right now" : "Nobody here"} description='Start an exit with "Initiate exit", or from an employee’s profile.' />
      ) : (
        <>
          <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-3 transition-opacity", loading && "opacity-60")}>
            {data.exits.map((x) => (
              <button key={x.id} type="button" onClick={() => setOpenId(x.id)} className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <PersonAvatar name={x.name} photoUrl={x.photo_url} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{x.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[x.designation, x.department].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <StatusBadge tone={STAGE_TONE[x.stage]}>{EXIT_STAGE_LABELS[x.stage]}</StatusBadge>
                </div>
                <Steps stage={x.stage} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Last day {fmtDate(x.exit_date)}</span>
                  {x.exit_reason && <span>{EXIT_REASON_LABELS[x.exit_reason]}</span>}
                  {x.stage !== "completed" && x.total_items > 0 && (
                    <span>
                      Clearance {x.total_items - x.pending_items}/{x.total_items}
                      {x.open_assets > 0 && ` · ${x.open_assets} asset${x.open_assets === 1 ? "" : "s"} out`}
                    </span>
                  )}
                  {x.settlement_status && Number(x.net_payable) !== 0 && <span>F&amp;F {inr(x.net_payable)}</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-xl border bg-card">
            <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={(p) => url.set({ page: p === 1 ? null : p })} onLimitChange={(l) => url.set({ limit: l === 20 ? null : l, page: null })} />
          </div>
        </>
      )}

      <ExitPanel employeeId={openId} onClose={() => setOpenId(null)} onChanged={reload} />
      <InitiateDialog
        open={initiating}
        onClose={() => setInitiating(false)}
        onDone={(id) => {
          reload();
          setOpenId(id);
        }}
      />
    </div>
  );
}
