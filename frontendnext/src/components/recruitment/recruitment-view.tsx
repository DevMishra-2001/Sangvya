"use client";

// Recruitment: overview, job openings, the candidate board, and interviews
import { useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness, CalendarClock, ClipboardCheck, Clock, Pencil, Plus, Search, Send, Trash2, UserCheck, Users } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { StatTile } from "@/components/common/stat-tile";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { recruitmentService } from "@/lib/services/recruitment";
import type { Candidate, CandidateDetail, Interview, JobPosting, JobStatus, RecruitmentOverview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { CandidateDialog } from "./candidate-dialog";
import { CandidatePanel } from "./candidate-panel";
import { FeedbackDialog } from "./interview-dialogs";
import { JobDialog } from "./job-dialog";
import { EMPLOYMENT, JOB_STATUS, MODES, SOURCES, STAGES, lakhs } from "./labels";
import { PipelineBoard } from "./pipeline-board";

function Overview({ data, onOpenCandidate }: { data: RecruitmentOverview | null; onOpenCandidate: (id: number) => void }) {
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const s = data.stats;
  const count = (k: string) => data.funnel.find((f) => f.stage === k)?.n ?? 0;
  const max = Math.max(1, ...STAGES.map((st) => count(st.key)));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={BriefcaseBusiness} value={s.openJobs} label={`Open jobs · ${s.openPositions} positions`} />
        <StatTile icon={Users} value={s.active} label="Candidates in process" tone="bg-info/15 text-info" />
        <StatTile icon={CalendarClock} value={s.interviewsWeek} label={`Interviews this week${s.pendingFeedback ? ` · ${s.pendingFeedback} need feedback` : ""}`} tone="bg-warning/15 text-warning" />
        <StatTile icon={Send} value={s.offersOut} label="Offers waiting for an answer" tone="bg-violet-500/12 text-violet-600 dark:text-violet-400" />
        <StatTile icon={UserCheck} value={s.hiredMonth} label="Hired this month" tone="bg-success/15 text-success" />
        <StatTile icon={Clock} value={s.avgDaysToHire == null ? "—" : `${s.avgDaysToHire}d`} label="Average time to hire" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-3">
          <FormHeading title="Pipeline" />
          <ul className="flex flex-col gap-3 p-4">
            {STAGES.map((st) => (
              <li key={st.key} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span>{st.label}</span>
                  <span className="text-muted-foreground tabular-nums">{count(st.key)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className={cn("h-2 rounded-full", st.dot)} style={{ width: `${(count(st.key) / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {data.sources.length > 0 && (
            <div className="border-t px-4 py-3 text-xs text-muted-foreground">
              Sources:{" "}
              {data.sources
                .sort((a, b) => b.n - a.n)
                .map((x) => `${SOURCES[x.source as keyof typeof SOURCES] ?? x.source} ${x.n}${x.hired ? ` (${x.hired} hired)` : ""}`)
                .join(" · ")}
            </div>
          )}
        </section>
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <FormHeading title="Upcoming interviews" />
          {!data.upcoming.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y">
              {data.upcoming.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => onOpenCandidate(i.candidate_id)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50">
                    <span className="font-medium">{i.candidate_name}</span> · {i.round_name}
                    <span className={cn("block text-xs", new Date(i.scheduled_at) < new Date() ? "text-destructive" : "text-muted-foreground")}>
                      {fmtDateTime(i.scheduled_at)} · {MODES[i.mode]} · {i.interviewer_name}
                      {new Date(i.scheduled_at) < new Date() && " · feedback pending"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Jobs({ jobs, canManage, onEdit, onChanged, onCandidates }: { jobs: JobPosting[]; canManage: boolean; onEdit: (j: JobPosting) => void; onChanged: () => void; onCandidates: (jobId: number) => void }) {
  if (!jobs.length) return <EmptyState icon={BriefcaseBusiness} title="No job openings yet" description="Open a job, then add candidates to it." />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {jobs.map((j) => {
        const total = Math.max(1, j.candidate_count);
        return (
          <article key={j.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{j.title}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {[j.department, j.location, j.employment_type && EMPLOYMENT[j.employment_type]].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <StatusBadge tone={JOB_STATUS[j.status].tone}>{JOB_STATUS[j.status].label}</StatusBadge>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`More for ${j.title}`}>
                      <Pencil />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(j)}>Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(["open", "on_hold", "closed"] as JobStatus[])
                      .filter((s) => s !== j.status)
                      .map((s) => (
                        <DropdownMenuItem key={s} onSelect={async () => (await run(() => recruitmentService.setJobStatus(j.id, s), { success: `Job ${JOB_STATUS[s].label.toLowerCase()}` })).ok && onChanged()}>
                          Mark {JOB_STATUS[s].label.toLowerCase()}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={async () => window.confirm(`Delete "${j.title}"?`) && (await run(() => recruitmentService.removeJob(j.id), { success: "Job deleted" })).ok && onChanged()}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {j.hired_count}/{j.openings} filled
              </span>
              {(j.experience_min != null || j.experience_max != null) && (
                <span>
                  {j.experience_min ?? 0}–{j.experience_max ?? "+"} yrs
                </span>
              )}
              {(j.salary_min || j.salary_max) && (
                <span>
                  {lakhs(j.salary_min)} – {lakhs(j.salary_max)}
                </span>
              )}
              {j.closes_on && <span>apply by {fmtDate(j.closes_on)}</span>}
              {j.hiring_manager_name && <span>Manager: {j.hiring_manager_name}</span>}
            </div>
            {/* Where this job's candidates are */}
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-label="Candidates by stage">
              {STAGES.map((s) => (j.stage_counts[s.key] ? <div key={s.key} className={s.dot} style={{ width: `${((j.stage_counts[s.key] ?? 0) / total) * 100}%` }} title={`${s.label}: ${j.stage_counts[s.key]}`} /> : null))}
            </div>
            <Button variant="outline" size="sm" className="self-start" onClick={() => onCandidates(j.id)}>
              <Users /> {j.candidate_count} candidate{j.candidate_count === 1 ? "" : "s"}
            </Button>
          </article>
        );
      })}
    </div>
  );
}

export function MyInterviewsList({ interviews, onFeedback }: { interviews: Interview[]; onFeedback: (i: Interview) => void }) {
  if (!interviews.length) return <EmptyState icon={ClipboardCheck} title="No interviews for you" description="When you're added as an interviewer, they show up here." />;
  return (
    <div className="flex flex-col gap-2">
      {interviews.map((i) => {
        const past = new Date(i.scheduled_at) < new Date();
        return (
          <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {i.candidate_name} · {i.job_title}
              </p>
              <p className="text-xs text-muted-foreground">
                {i.round_name} · {fmtDateTime(i.scheduled_at)} · {MODES[i.mode]}
                {i.location && ` · ${i.location}`}
              </p>
            </div>
            {i.status === "completed" ? (
              <StatusBadge tone="success">Feedback given</StatusBadge>
            ) : (
              <Button size="sm" variant={past ? "default" : "outline"} onClick={() => onFeedback(i)}>
                {past ? "Give feedback" : "Add feedback"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RecruitmentView() {
  const can = useCan();
  const canManage = can("recruitment.manage");
  const canEdit = can("recruitment.candidates");
  const url = useUrlParams();
  const tab = url.get("tab", "overview");
  const jobFilter = url.get("job");
  const [typed, setTyped] = useState("");
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [mine, setMine] = useState<Interview[]>([]);
  const [jobDialog, setJobDialog] = useState<{ open: boolean; job: JobPosting | null }>({ open: false, job: null });
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // One load per change (tab switches don't refetch)
  useEffect(() => {
    let cancelled = false;
    Promise.all([recruitmentService.overview(), recruitmentService.jobs(), recruitmentService.candidates(), recruitmentService.myInterviews()])
      .then(([o, j, c, m]) => {
        if (cancelled) return;
        setOverview(o);
        setJobs(j);
        setCandidates(c);
        setMine(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  const q = typed.trim().toLowerCase();
  const visible = (candidates ?? []).filter((c) => (!jobFilter || String(c.job_posting_id) === jobFilter) && (!q || [c.name, c.email, c.phone, c.current_company].some((v) => v?.toLowerCase().includes(q))));
  const pendingMine = mine.filter((i) => i.status === "scheduled").length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Recruitment"
        description="Open jobs, move candidates through interviews, send offers, and hire."
        className="mb-0"
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => setAdding(true)} disabled={!jobs.length}>
                <Plus /> Add candidate
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setJobDialog({ open: true, job: null })}>
                <BriefcaseBusiness /> New job
              </Button>
            )}
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => url.set({ tab: v === "overview" ? null : v })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
          <TabsTrigger value="board">Candidates ({candidates?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="mine">My interviews{pendingMine ? ` (${pendingMine})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Overview data={overview} onOpenCandidate={setOpenId} />
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <Jobs jobs={jobs} canManage={canManage} onEdit={(job) => setJobDialog({ open: true, job })} onChanged={refresh} onCandidates={(id) => url.set({ tab: "board", job: String(id) })} />
        </TabsContent>
        <TabsContent value="board" className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <SelectField className="w-60" value={jobFilter} onValueChange={(v) => url.set({ job: v || null })} emptyLabel="All jobs" options={jobs.map((j) => ({ value: String(j.id), label: j.title }))} aria-label="Job" />
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Name, email, phone, company…" value={typed} onChange={(e) => setTyped(e.target.value)} className="pl-8" aria-label="Search candidates" />
            </div>
          </div>
          {!candidates ? <Skeleton className="h-80 rounded-xl" /> : <PipelineBoard candidates={visible} canMove={canEdit} onOpen={setOpenId} onChanged={refresh} />}
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <MyInterviewsList interviews={mine} onFeedback={setFeedbackFor} />
        </TabsContent>
      </Tabs>

      <JobDialog open={jobDialog.open} job={jobDialog.job} onClose={() => setJobDialog({ open: false, job: null })} onSaved={refresh} />
      <CandidateDialog
        open={adding}
        candidate={null}
        jobs={jobs}
        defaultJobId={jobFilter || undefined}
        onClose={() => setAdding(false)}
        onSaved={(d: CandidateDetail) => {
          refresh();
          setOpenId(d.candidate.id);
        }}
      />
      <CandidatePanel candidateId={openId} jobs={jobs} onClose={() => setOpenId(null)} onChanged={refresh} />
      <FeedbackDialog interview={feedbackFor} onClose={() => setFeedbackFor(null)} onDone={refresh} />
    </div>
  );
}
