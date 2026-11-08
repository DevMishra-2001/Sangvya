"use client";

// One review: goals with check-ins, self review, manager review, HR finalize, employee acknowledge
import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { PersonAvatar } from "@/components/common/person-avatar";
import { SelectField } from "@/components/common/select-field";
import { StarRating } from "@/components/common/star-rating";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDate, timeAgo } from "@/lib/format";
import { performanceService } from "@/lib/services/performance";
import type { Goal, GoalStatus, ReviewDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEmployeesStore } from "@/stores/employees-store";
import { GOAL_STATUS, REVIEW_STATUS, STEPS } from "./labels";

function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function GoalDialog({ goal, open, onClose, onSave }: { goal: Goal | null; open: boolean; onClose: () => void; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [weight, setWeight] = useState("20");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setTitle(goal?.title ?? "");
      setTarget(goal?.target ?? "");
      setWeight(String(goal?.weight ?? 20));
      setDescription(goal?.description ?? "");
    });
  }, [open, goal]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>A clear, measurable outcome for this cycle. Weights of all goals ideally add up to 100.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Goal" htmlFor="gl-title" required span="full">
            <Input id="gl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </FormField>
          <FormField label="Target / measure" htmlFor="gl-target" span="md">
            <Input id="gl-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 20 new clients" maxLength={200} />
          </FormField>
          <FormField label="Weight (%)" htmlFor="gl-weight" span="md">
            <Input id="gl-weight" type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </FormField>
          <FormField label="Details" htmlFor="gl-desc" span="full">
            <Textarea id="gl-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || title.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              const ok = await onSave({ title, target: target || null, weight: Number(weight) || 0, description: description || null });
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy && <Spinner />} Save goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckinDialog({ goal, onClose, onSave }: { goal: Goal | null; onClose: () => void; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [progress, setProgress] = useState("0");
  const [status, setStatus] = useState<GoalStatus>("on_track");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!goal) return;
    queueMicrotask(() => {
      setProgress(String(goal.progress));
      setStatus(goal.status);
      setNote("");
    });
  }, [goal]);
  return (
    <Dialog open={Boolean(goal)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update progress</DialogTitle>
          <DialogDescription>{goal?.title}</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Progress (%)" htmlFor="ck-p" span="md">
            <Input id="ck-p" type="number" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(e.target.value)} />
          </FormField>
          <FormField label="Status" htmlFor="ck-s" span="md">
            <SelectField id="ck-s" value={status} onValueChange={(v) => setStatus(v as GoalStatus)} options={Object.entries(GOAL_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
          </FormField>
          <FormField label="What happened" htmlFor="ck-n" span="full">
            <Textarea id="ck-n" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onSave({ progress: Math.min(100, Math.max(0, Number(progress) || 0)), status, note: note || null });
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy && <Spinner />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewPanel({ reviewId, onClose, onChanged }: { reviewId: number | null; onClose: () => void; onChanged: () => void }) {
  const employees = useEmployeesStore((s) => s.list);
  const [d, setD] = useState<ReviewDetail | null>(null);
  const [goalDialog, setGoalDialog] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });
  const [checkinFor, setCheckinFor] = useState<Goal | null>(null);
  // Ratings being filled (goal id → stars; competency → stars)
  const [goalRatings, setGoalRatings] = useState<Record<number, number>>({});
  const [compRatings, setCompRatings] = useState<Record<string, number>>({});
  const [overall, setOverall] = useState<number | null>(null);
  const [text, setText] = useState({ comments: "", strengths: "", improvements: "", goalsNextCycle: "", hr: "", ack: "" });
  const [finalRating, setFinalRating] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Load, and prefill the form for whoever is filling it now
  function fill(x: ReviewDetail) {
    setD(x);
    const asManager = x.review.status !== "pending_self" && (x.you.isManager || x.you.isHr) && !x.you.isSelf;
    setGoalRatings(Object.fromEntries(x.goals.map((g) => [g.id, (asManager ? g.manager_rating : g.self_rating) ?? 0]).filter(([, v]) => v)));
    setCompRatings(Object.fromEntries(Object.entries(x.review.competency_ratings).map(([k, v]) => [k, (asManager ? v.manager : v.self) ?? 0]).filter(([, v]) => v)));
    setOverall(asManager ? x.review.rating : x.review.self_rating);
    setText({ comments: (asManager ? x.review.manager_comments : x.review.self_comments) ?? "", strengths: x.review.strengths ?? "", improvements: x.review.improvements ?? "", goalsNextCycle: x.review.goals_next_cycle ?? "", hr: x.review.hr_comments ?? "", ack: "" });
    setFinalRating(x.review.final_rating ?? (x.review.score ? Math.round(Number(x.review.score)) : x.review.rating));
  }

  useEffect(() => {
    if (reviewId == null) return;
    let cancelled = false;
    run(() => performanceService.review(reviewId)).then((r) => !cancelled && r.ok && fill(r.data));
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  async function act(key: string, fn: () => Promise<ReviewDetail>, success?: string) {
    setBusy(key);
    const r = await run(fn, { success });
    setBusy(null);
    if (!r.ok) return false;
    fill(r.data);
    onChanged();
    return true;
  }

  if (reviewId == null) return null;
  const r = d?.review;
  const status = r?.status;
  const you = d?.you;
  const open = d && d.cycle.status !== "closed" && status !== "finalized" && status !== "acknowledged";
  const fillingSelf = Boolean(you?.isSelf && status === "pending_self" && open);
  const fillingManager = Boolean(!you?.isSelf && (you?.isManager || you?.isHr) && (status === "pending_manager" || status === "pending_self" || (status === "pending_hr" && you?.isHr)) && open);
  const filling = fillingSelf || fillingManager;
  const canEditGoals = Boolean(open && (you?.isManager || you?.isHr || (you?.isSelf && status === "pending_self")));
  const totalWeight = d?.goals.reduce((t, g) => t + g.weight, 0) ?? 0;
  const stepIndex = STEPS.findIndex((s) => s.key === status);
  const goalBody = () => ({
    goalRatings: Object.entries(goalRatings).map(([goalId, rating]) => ({ goalId: Number(goalId), rating })),
    competencies: compRatings,
    rating: overall,
  });

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) {
          setD(null);
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {!d || !r ? (
          <div className="flex flex-col gap-3 p-6">
            <SheetTitle className="sr-only">Review</SheetTitle>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-center gap-3 pr-8">
                <PersonAvatar name={r.employee_name} photoUrl={r.photo_url} className="size-11" />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{r.employee_name}</SheetTitle>
                  <SheetDescription className="truncate">
                    {d.cycle.name} · {[r.designation, r.manager_name && `reviewer ${r.manager_name}`].filter(Boolean).join(" · ")}
                  </SheetDescription>
                </div>
                <StatusBadge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</StatusBadge>
              </div>
              {/* Where the review is */}
              <ol className="mt-3 flex gap-1">
                {STEPS.filter((s) => d.cycle.self_review || s.key !== "pending_self").map((s) => {
                  const i = STEPS.findIndex((x) => x.key === s.key);
                  return (
                    <li key={s.key} className="flex-1">
                      <div className={cn("h-1.5 rounded-full", i < stepIndex ? "bg-success" : i === stepIndex ? "bg-primary" : "bg-muted")} />
                      <p className={cn("mt-1 text-[10px]", i === stepIndex ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</p>
                    </li>
                  );
                })}
              </ol>
              {you?.isHr && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Reviewer</span>
                  <SelectField
                    size="sm"
                    className="w-56"
                    value={r.manager_id ? String(r.manager_id) : ""}
                    onValueChange={(v) => act("reviewer", () => performanceService.setReviewer(r.id, v ? Number(v) : null), "Reviewer changed")}
                    emptyLabel="Nobody (HR reviews)"
                    options={employees.filter((e) => e.id !== r.employee_id && e.status !== "exited").map((e) => ({ value: String(e.id), label: e.name }))}
                    aria-label="Reviewer"
                  />
                </div>
              )}
            </SheetHeader>

            <div className="flex flex-col gap-4 p-5">
              {/* Results once final */}
              {(status === "finalized" || status === "acknowledged") && r.final_rating && (
                <div className="flex items-center gap-4 rounded-xl border bg-primary/5 p-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold tabular-nums">{r.final_rating}</p>
                    <p className="text-xs text-muted-foreground">of 5</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{d.ratingLabels[r.final_rating]}</p>
                    {r.score && <p className="text-xs text-muted-foreground">Calculated score {Number(r.score).toFixed(2)}</p>}
                    {r.hr_comments && <p className="mt-1 text-sm">{r.hr_comments}</p>}
                  </div>
                </div>
              )}

              <Section
                title={`Goals · ${d.goals.length}${d.goals.length ? ` · weight ${totalWeight}%` : ""}`}
                actions={
                  canEditGoals && (
                    <Button size="sm" variant="outline" onClick={() => setGoalDialog({ open: true, goal: null })}>
                      <Plus /> Add goal
                    </Button>
                  )
                }
              >
                {!d.goals.length && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No goals yet{canEditGoals ? " — add what this person should achieve this cycle." : "."}</p>}
                {totalWeight !== 100 && d.goals.length > 0 && canEditGoals && <p className="text-xs text-warning">Weights add up to {totalWeight}% — make them 100%.</p>}
                {d.goals.map((g) => (
                  <div key={g.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{g.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[g.target && `Target: ${g.target}`, `Weight ${g.weight}%`].filter(Boolean).join(" · ")}
                        </p>
                        {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                      </div>
                      <StatusBadge tone={GOAL_STATUS[g.status].tone}>{GOAL_STATUS[g.status].label}</StatusBadge>
                      {canEditGoals && (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label="Edit goal" onClick={() => setGoalDialog({ open: true, goal: g })}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Delete goal" onClick={() => window.confirm(`Delete "${g.title}"?`) && act("goal", () => performanceService.deleteGoal(g.id), "Goal deleted")}>
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div className={cn("h-2 rounded-full", g.status === "off_track" ? "bg-destructive" : g.status === "at_risk" ? "bg-warning" : "bg-success")} style={{ width: `${g.progress}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums">{g.progress}%</span>
                      {open && (you?.isSelf || you?.isManager) && (
                        <Button size="sm" variant="ghost" onClick={() => setCheckinFor(g)}>
                          <TrendingUp /> Update
                        </Button>
                      )}
                    </div>
                    {g.checkins[0] && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last update: {g.checkins[0].note || `${g.checkins[0].progress}%`} — {g.checkins[0].by}, {timeAgo(g.checkins[0].created_at)}
                      </p>
                    )}
                    {/* Ratings: what's given, and the stars to fill now */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {g.self_rating != null && !fillingSelf && (
                        <span className="flex items-center gap-1">
                          Self <StarRating value={g.self_rating} readOnly />
                        </span>
                      )}
                      {g.manager_rating != null && !fillingManager && (
                        <span className="flex items-center gap-1">
                          Manager <StarRating value={g.manager_rating} readOnly />
                        </span>
                      )}
                      {filling && (
                        <span className="flex items-center gap-1 font-medium">
                          Your rating <StarRating value={goalRatings[g.id] ?? null} onChange={(n) => setGoalRatings((m) => ({ ...m, [g.id]: n }))} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </Section>

              {d.cycle.competencies.length > 0 && (
                <Section title={`Competencies · ${100 - d.cycle.goals_weight}% of the score`}>
                  <div className="divide-y rounded-lg border">
                    {d.cycle.competencies.map((c) => {
                      const given = r.competency_ratings[c] ?? {};
                      return (
                        <div key={c} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                          <span className="min-w-36 flex-1">{c}</span>
                          {given.self != null && !fillingSelf && (
                            <span className="flex items-center gap-1 text-xs">
                              Self <StarRating value={given.self} readOnly />
                            </span>
                          )}
                          {given.manager != null && !fillingManager && (
                            <span className="flex items-center gap-1 text-xs">
                              Manager <StarRating value={given.manager} readOnly />
                            </span>
                          )}
                          {filling && <StarRating value={compRatings[c] ?? null} onChange={(n) => setCompRatings((m) => ({ ...m, [c]: n }))} />}
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Written parts already given */}
              {!fillingSelf && r.self_comments && (
                <Section title={`Self review${r.self_rating ? ` · ${r.self_rating}/5` : ""}`}>
                  <p className="text-sm whitespace-pre-line">{r.self_comments}</p>
                </Section>
              )}
              {!fillingManager && (r.strengths || r.improvements || r.manager_comments) && (
                <Section title={`Manager review${r.rating ? ` · ${r.rating}/5` : ""}`}>
                  {r.strengths && (
                    <p className="text-sm">
                      <span className="font-medium">Strengths: </span>
                      {r.strengths}
                    </p>
                  )}
                  {r.improvements && (
                    <p className="text-sm">
                      <span className="font-medium">To improve: </span>
                      {r.improvements}
                    </p>
                  )}
                  {r.goals_next_cycle && (
                    <p className="text-sm">
                      <span className="font-medium">Next cycle: </span>
                      {r.goals_next_cycle}
                    </p>
                  )}
                  {r.manager_comments && <p className="text-sm whitespace-pre-line">{r.manager_comments}</p>}
                </Section>
              )}

              {/* The form for whoever acts now */}
              {fillingSelf && (
                <Section title="Your self review">
                  <FormGrid density="dialog">
                    <FormField label="Overall, how did you do?" htmlFor="sr-o" float={false} span="full">
                      <StarRating value={overall} onChange={setOverall} />
                    </FormField>
                    <FormField label="Your achievements and challenges" htmlFor="sr-c" span="full">
                      <Textarea id="sr-c" rows={4} value={text.comments} onChange={(e) => setText((t) => ({ ...t, comments: e.target.value }))} />
                    </FormField>
                  </FormGrid>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={busy !== null} onClick={() => act("save", () => performanceService.self(r.id, { ...goalBody(), comments: text.comments, submit: false }), "Saved as draft")}>
                      Save draft
                    </Button>
                    <Button disabled={busy !== null} onClick={() => window.confirm("Submit your self review? You can't change it after.") && act("submit", () => performanceService.self(r.id, { ...goalBody(), comments: text.comments, submit: true }), "Self review submitted")}>
                      {busy === "submit" && <Spinner />} Submit to manager
                    </Button>
                  </div>
                </Section>
              )}
              {fillingManager && (
                <Section title={status === "pending_hr" ? "Manager review (HR editing)" : "Your review"}>
                  {status === "pending_self" && d.cycle.self_review && <p className="text-xs text-muted-foreground">The self review isn&apos;t in yet — you can still start yours.</p>}
                  <FormGrid density="dialog">
                    <FormField label="Overall rating" htmlFor="mr-o" float={false} span="full" description="Leave empty to use the calculated score">
                      <StarRating value={overall} onChange={setOverall} />
                    </FormField>
                    <FormField label="Strengths" htmlFor="mr-s" span="full">
                      <Textarea id="mr-s" rows={2} value={text.strengths} onChange={(e) => setText((t) => ({ ...t, strengths: e.target.value }))} />
                    </FormField>
                    <FormField label="Areas to improve" htmlFor="mr-i" span="full">
                      <Textarea id="mr-i" rows={2} value={text.improvements} onChange={(e) => setText((t) => ({ ...t, improvements: e.target.value }))} />
                    </FormField>
                    <FormField label="Focus for next cycle" htmlFor="mr-n" span="full">
                      <Textarea id="mr-n" rows={2} value={text.goalsNextCycle} onChange={(e) => setText((t) => ({ ...t, goalsNextCycle: e.target.value }))} />
                    </FormField>
                    <FormField label="Other comments" htmlFor="mr-c" span="full">
                      <Textarea id="mr-c" rows={2} value={text.comments} onChange={(e) => setText((t) => ({ ...t, comments: e.target.value }))} />
                    </FormField>
                  </FormGrid>
                  <div className="flex gap-2">
                    {(() => {
                      const body = (submit: boolean) => ({ ...goalBody(), strengths: text.strengths, improvements: text.improvements, goalsNextCycle: text.goalsNextCycle, comments: text.comments, submit });
                      return (
                        <>
                          <Button variant="outline" disabled={busy !== null} onClick={() => act("save", () => performanceService.manager(r.id, body(false)), "Saved")}>
                            Save draft
                          </Button>
                          {status !== "pending_hr" && (
                            <Button disabled={busy !== null} onClick={() => window.confirm("Send this review to HR?") && act("submit", () => performanceService.manager(r.id, body(true)), "Sent to HR")}>
                              {busy === "submit" && <Spinner />} Submit to HR
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </Section>
              )}

              {you?.isHr && status === "pending_hr" && (
                <Section title="HR — finalize">
                  <p className="text-sm">
                    Calculated score <strong className="tabular-nums">{r.score ? Number(r.score).toFixed(2) : "—"}</strong> · manager&apos;s rating {r.rating ?? "—"}
                  </p>
                  <FormGrid density="dialog">
                    <FormField label="Final rating (after calibration)" htmlFor="hr-f" float={false} span="full" description={finalRating ? d.ratingLabels[finalRating] : undefined}>
                      <StarRating value={finalRating} onChange={setFinalRating} />
                    </FormField>
                    <FormField label="Note to the employee" htmlFor="hr-c" span="full">
                      <Textarea id="hr-c" rows={2} value={text.hr} onChange={(e) => setText((t) => ({ ...t, hr: e.target.value }))} />
                    </FormField>
                  </FormGrid>
                  <div className="flex gap-2">
                    <Button disabled={!finalRating || busy !== null} onClick={() => act("final", () => performanceService.finalize(r.id, { finalRating: finalRating!, hrComments: text.hr || undefined }), "Review finalized — the employee is notified")}>
                      <Check /> Finalize
                    </Button>
                    <Button variant="ghost" disabled={busy !== null} onClick={() => act("reopen", () => performanceService.reopen(r.id), "Sent back to the manager")}>
                      Send back to manager
                    </Button>
                  </div>
                </Section>
              )}
              {you?.isHr && status === "finalized" && d.cycle.status !== "closed" && (
                <Button variant="ghost" className="self-start" onClick={() => act("reopen", () => performanceService.reopen(r.id), "Reopened for the manager")}>
                  Reopen review
                </Button>
              )}

              {you?.isSelf && status === "finalized" && (
                <Section title="Acknowledge">
                  <Textarea rows={2} value={text.ack} onChange={(e) => setText((t) => ({ ...t, ack: e.target.value }))} placeholder="Any comment on your review (optional)" aria-label="Comment" />
                  <Button className="self-start" disabled={busy !== null} onClick={() => act("ack", () => performanceService.acknowledge(r.id, text.ack || undefined), "Acknowledged")}>
                    <Check /> I&apos;ve read my review
                  </Button>
                </Section>
              )}
              {status === "acknowledged" && (
                <p className="text-sm text-muted-foreground">
                  Acknowledged {r.acknowledged_at && fmtDate(r.acknowledged_at)}
                  {r.employee_comment && ` — “${r.employee_comment}”`}
                </p>
              )}
            </div>

            <GoalDialog
              open={goalDialog.open}
              goal={goalDialog.goal}
              onClose={() => setGoalDialog({ open: false, goal: null })}
              onSave={(b) => act("goal", () => (goalDialog.goal ? performanceService.updateGoal(goalDialog.goal.id, b) : performanceService.addGoal(r.id, b)), "Goal saved")}
            />
            <CheckinDialog goal={checkinFor} onClose={() => setCheckinFor(null)} onSave={(b) => act("checkin", () => performanceService.checkin(checkinFor!.id, b), "Progress updated")} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
