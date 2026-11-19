"use client";

// HR: review cycles — set up, launch to people, follow progress, calibrate and finalize
import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Rocket, Star } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormGrid } from "@/components/common/form-layout";
import { MultiSelect } from "@/components/common/multi-select";
import { PageHeader } from "@/components/common/page-header";
import { PersonAvatar } from "@/components/common/person-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { performanceService } from "@/lib/services/performance";
import type { ReviewCycle, ReviewRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useDepartmentsStore } from "@/stores/departments-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { RATING_LABELS, REVIEW_STATUS, STEPS } from "./labels";
import { ReviewPanel } from "./review-panel";

const DEFAULT_COMPETENCIES = "Quality of work\nOwnership\nCommunication\nTeamwork\nLearning";

function CycleDialog({ open, cycle, onClose, onSaved }: { open: boolean; cycle: ReviewCycle | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", description: "", startDate: "", endDate: "", selfDue: "", managerDue: "", goalsWeight: "70", competencies: DEFAULT_COMPETENCIES });
  const [selfReview, setSelfReview] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setF(
        cycle
          ? { name: cycle.name, description: cycle.description ?? "", startDate: cycle.start_date, endDate: cycle.end_date, selfDue: cycle.self_due ?? "", managerDue: cycle.manager_due ?? "", goalsWeight: String(cycle.goals_weight), competencies: cycle.competencies.join("\n") }
          : { name: "", description: "", startDate: "", endDate: "", selfDue: "", managerDue: "", goalsWeight: "70", competencies: DEFAULT_COMPETENCIES },
      );
      setSelfReview(cycle?.self_review ?? true);
    });
  }, [open, cycle]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    const body = { ...f, selfReview, goalsWeight: Number(f.goalsWeight) || 0, competencies: f.competencies.split("\n").map((c) => c.trim()).filter((c) => c.length >= 2), selfDue: f.selfDue || null, managerDue: f.managerDue || null };
    const r = await run(() => (cycle ? performanceService.updateCycle(cycle.id, body) : performanceService.createCycle(body)), { success: cycle ? "Cycle updated" : "Cycle created — launch it when ready" });
    setBusy(false);
    if (!r.ok) return;
    onClose();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cycle ? "Edit review cycle" : "New review cycle"}</DialogTitle>
          <DialogDescription>The period being reviewed, deadlines, and how the score is made.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Name" htmlFor="cy-name" required span="md">
            <Input id="cy-name" value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="Annual review 2026" />
          </FormField>
          <FormField label="Period from" htmlFor="cy-start" required>
            <DatePicker id="cy-start" value={f.startDate} onChange={set("startDate")} />
          </FormField>
          <FormField label="Period to" htmlFor="cy-end" required>
            <DatePicker id="cy-end" value={f.endDate} onChange={set("endDate")} min={f.startDate || undefined} />
          </FormField>
          <FieldSeparator label="Steps & deadlines" />
          <label className="col-span-12 flex items-center gap-2 text-sm md:col-span-4">
            <Switch checked={selfReview} onCheckedChange={setSelfReview} aria-label="Self review" /> Employees fill a self review
          </label>
          {selfReview && (
            <FormField label="Self review by" htmlFor="cy-sd">
              <DatePicker id="cy-sd" value={f.selfDue} onChange={set("selfDue")} clearable />
            </FormField>
          )}
          <FormField label="Manager review by" htmlFor="cy-md">
            <DatePicker id="cy-md" value={f.managerDue} onChange={set("managerDue")} clearable />
          </FormField>
          <FieldSeparator label="Score" />
          <FormField label="Goals weight (%)" htmlFor="cy-gw" description={`Competencies make up the other ${100 - (Number(f.goalsWeight) || 0)}%`}>
            <Input id="cy-gw" type="number" min={0} max={100} value={f.goalsWeight} onChange={(e) => set("goalsWeight")(e.target.value)} />
          </FormField>
          <FormField label="Competencies (one per line)" htmlFor="cy-comp" span="lg">
            <Textarea id="cy-comp" rows={5} value={f.competencies} onChange={(e) => set("competencies")(e.target.value)} />
          </FormField>
          <FormField label="Note to everyone" htmlFor="cy-desc" span="full">
            <Textarea id="cy-desc" rows={2} value={f.description} onChange={(e) => set("description")(e.target.value)} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || f.name.trim().length < 2 || !f.startDate || !f.endDate}>
            {busy && <Spinner />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LaunchDialog({ cycle, onClose, onDone }: { cycle: ReviewCycle | null; onClose: () => void; onDone: () => void }) {
  const departments = useDepartmentsStore((s) => s.list);
  const loadDepartments = useDepartmentsStore((s) => s.load);
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cycle) loadDepartments();
  }, [cycle, loadDepartments]);
  return (
    <Dialog open={Boolean(cycle)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Launch “{cycle?.name}”</DialogTitle>
          <DialogDescription>Adds every active employee (or the departments you pick) and notifies them. Their reporting manager reviews them. You can run it again later for new joiners.</DialogDescription>
        </DialogHeader>
        <FormField label="Departments" htmlFor="ln-dept" description="Leave empty for everyone">
          <MultiSelect id="ln-dept" value={ids} onChange={setIds} options={departments.map((d) => ({ value: String(d.id), label: d.name }))} placeholder="All departments" />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!cycle) return;
              setBusy(true);
              const r = await run(() => performanceService.launch(cycle.id, { departmentIds: ids.length ? ids.map(Number) : undefined }), { success: (d) => `Launched — ${d.added} people added` });
              setBusy(false);
              if (r.ok) {
                onClose();
                onDone();
              }
            }}
          >
            {busy ? <Spinner /> : <Rocket />} Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PerformanceView() {
  const canManage = useCan()("performance.manageCycles");
  const loadEmployees = useEmployeesStore((s) => s.load);
  const url = useUrlParams();
  const cycleParam = url.getNumber("cycle", 0);
  const [cycles, setCycles] = useState<ReviewCycle[] | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; cycle: ReviewCycle | null }>({ open: false, cycle: null });
  const [launching, setLaunching] = useState<ReviewCycle | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    let cancelled = false;
    run(() => performanceService.cycles()).then((r) => !cancelled && r.ok && setCycles(r.data));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const selected = cycles?.find((c) => c.id === cycleParam) ?? cycles?.[0] ?? null;
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    run(() => performanceService.cycleReviews(selectedId)).then((r) => !cancelled && r.ok && setReviews(r.data));
    return () => {
      cancelled = true;
    };
  }, [selectedId, version]);

  const finals = (reviews ?? []).map((r) => r.final_rating ?? (r.status === "pending_hr" && r.score ? Math.round(Number(r.score)) : null)).filter((n): n is number => Boolean(n));
  const dist = [1, 2, 3, 4, 5].map((n) => finals.filter((f) => f === n).length);
  const distMax = Math.max(1, ...dist);
  const shown = (reviews ?? []).filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Performance"
        description="Review cycles: goals, self review, manager review, HR calibration."
        className="mb-0"
        actions={
          canManage && (
            <Button onClick={() => setDialog({ open: true, cycle: null })}>
              <Plus /> New cycle
            </Button>
          )
        }
      />

      {cycles && !cycles.length ? (
        <EmptyState icon={Star} title="No review cycles yet" description="Create a cycle, then launch it to your team." />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cycles?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => url.set({ cycle: c.id })}
                className={cn("flex min-w-56 flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors", selected?.id === c.id ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40")}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  <StatusBadge tone={c.status === "active" ? "success" : c.status === "draft" ? "warning" : "neutral"}>{c.status === "draft" ? "Not launched" : c.status === "active" ? "Active" : "Closed"}</StatusBadge>
                </span>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(c.start_date)} – {fmtDate(c.end_date)} · {c.review_count} people
                </span>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Goals {selected.goals_weight}% · competencies {100 - selected.goals_weight}%{selected.self_due && ` · self review by ${fmtDate(selected.self_due)}`}
                    {selected.manager_due && ` · manager review by ${fmtDate(selected.manager_due)}`}
                  </p>
                </div>
                {canManage && selected.status !== "closed" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, cycle: selected })}>
                      <Pencil /> Edit
                    </Button>
                    <Button size="sm" onClick={() => setLaunching(selected)}>
                      <Rocket /> {selected.launched_at ? "Add people" : "Launch"}
                    </Button>
                    {selected.launched_at && (
                      <Button size="sm" variant="ghost" onClick={async () => window.confirm(`Close “${selected.name}”? Nothing can be changed after.`) && (await run(() => performanceService.setCycleStatus(selected.id, "closed"), { success: "Cycle closed" })).ok && refresh()}>
                        <Lock /> Close
                      </Button>
                    )}
                  </>
                )}
                {canManage && selected.status === "closed" && (
                  <Button size="sm" variant="outline" onClick={async () => (await run(() => performanceService.setCycleStatus(selected.id, "active"), { success: "Cycle reopened" })).ok && refresh()}>
                    Reopen
                  </Button>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-5">
                <Card className="gap-0 py-0 lg:col-span-3">
                  <p className="border-b px-4 py-2 text-sm font-semibold">Progress</p>
                  <div className="flex flex-wrap gap-2 p-4">
                    <button type="button" onClick={() => setStatusFilter("")} className={cn("rounded-lg border px-3 py-2 text-left text-sm", !statusFilter && "border-primary bg-primary/5")}>
                      <span className="block text-lg font-semibold tabular-nums">{selected.review_count}</span>
                      <span className="text-xs text-muted-foreground">Everyone</span>
                    </button>
                    {STEPS.filter((s) => selected.self_review || s.key !== "pending_self").map((s) => (
                      <button key={s.key} type="button" onClick={() => setStatusFilter(statusFilter === s.key ? "" : s.key)} className={cn("rounded-lg border px-3 py-2 text-left text-sm", statusFilter === s.key && "border-primary bg-primary/5")}>
                        <span className="block text-lg font-semibold tabular-nums">{selected.by_status[s.key] ?? 0}</span>
                        <span className="text-xs text-muted-foreground">{REVIEW_STATUS[s.key].label}</span>
                      </button>
                    ))}
                  </div>
                </Card>
                <Card className="gap-0 py-0 lg:col-span-2">
                  <p className="border-b px-4 py-2 text-sm font-semibold">Rating distribution</p>
                  <div className="flex h-36 items-end gap-3 px-4 pt-4 pb-2" role="img" aria-label="Ratings 1 to 5">
                    {dist.map((n, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${RATING_LABELS[i + 1]}: ${n}`}>
                        <span className="text-xs tabular-nums">{n}</span>
                        <div className="w-full max-w-10 rounded-t bg-primary" style={{ height: `${(n / distMax) * 80}px`, minHeight: n ? 4 : 0 }} />
                        <span className="text-xs text-muted-foreground">{i + 1}★</span>
                      </div>
                    ))}
                  </div>
                  <p className="px-4 pb-3 text-[11px] text-muted-foreground">Final ratings, or the calculated score while with HR.</p>
                </Card>
              </div>

              <Card className="gap-0 overflow-hidden py-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead className="text-right">Goals</TableHead>
                        <TableHead className="text-right">Self</TableHead>
                        <TableHead className="text-right">Manager</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Final</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!shown.length && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            {selected.launched_at ? "Nobody in this step." : "Launch the cycle to add people."}
                          </TableCell>
                        </TableRow>
                      )}
                      {shown.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <PersonAvatar name={r.employee_name} photoUrl={r.photo_url} className="size-7" />
                              <span>
                                <span className="block font-medium">{r.employee_name}</span>
                                <span className="block text-xs text-muted-foreground">{[r.designation, r.department].filter(Boolean).join(" · ")}</span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className={cn("text-sm", !r.manager_name && "text-warning")}>{r.manager_name ?? "None — HR"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.goal_count}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.self_rating ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.rating ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.score ? Number(r.score).toFixed(2) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{r.final_rating ?? "—"}</TableCell>
                          <TableCell>
                            <StatusBadge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</StatusBadge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      <CycleDialog open={dialog.open} cycle={dialog.cycle} onClose={() => setDialog({ open: false, cycle: null })} onSaved={refresh} />
      <LaunchDialog cycle={launching} onClose={() => setLaunching(null)} onDone={refresh} />
      <ReviewPanel reviewId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
    </div>
  );
}
