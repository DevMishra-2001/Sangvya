"use client";

import { useEffect, useState } from "react";
import { Briefcase, ExternalLink, Plus, UserCheck, Users } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CANDIDATE_STAGES } from "@/lib/constants";
import type { CandidateStage, Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useRecruitmentStore } from "@/stores/recruitment-store";
import { CandidateFormDialog } from "./candidate-form-dialog";
import { JobFormDialog } from "./job-form-dialog";
import { SelectField } from "@/components/common/select-field";

export function RecruitmentView() {
  const can = useCan();
  const canManage = can("recruitment.manage");
  const canEditCandidates = can("recruitment.candidates");
  const jobs = useRecruitmentStore((s) => s.jobs);
  const candidates = useRecruitmentStore((s) => s.candidates);
  const load = useRecruitmentStore((s) => s.load);
  const setJobStatus = useRecruitmentStore((s) => s.setJobStatus);
  const removeJob = useRecruitmentStore((s) => s.removeJob);
  const setStage = useRecruitmentStore((s) => s.setStage);
  const removeCandidate = useRecruitmentStore((s) => s.removeCandidate);
  const convertToEmployee = useRecruitmentStore((s) => s.convertToEmployee);
  const [tab, setTab] = useState("jobs");
  const [selectedJobId, setSelectedJobId] = useState<Id | null>(null);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [candidateFormOpen, setCandidateFormOpen] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const visibleCandidates = selectedJobId ? candidates.filter((c) => c.job_posting_id === selectedJobId) : candidates;
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div>
      <PageHeader title="Recruitment" description="Job postings and the candidate pipeline." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="jobs">Job postings</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="flex flex-col gap-3">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setJobFormOpen(true)}>
                <Plus /> New job
              </Button>
            </div>
          )}
          {jobs.length === 0 ? (
            <EmptyState icon={Briefcase} title="No job postings yet" description={canManage ? 'Click "New job" to get started.' : undefined} />
          ) : (
            jobs.map((job) => (
              <Card key={job.id} className={cn("py-3.5 transition-colors", selectedJobId === job.id && "border-primary")}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setTab("candidates");
                    }}
                  >
                    <div className="text-sm font-medium">{job.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[job.department, job.location].filter(Boolean).join(" · ") || "—"} · {job.candidate_count} candidate{Number(job.candidate_count) === 1 ? "" : "s"}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={job.status} />
                    {canManage && (
                      <>
                        <SelectField
                          size="sm"
                          className="w-auto"
                          value={job.status}
                          onValueChange={(v) => setJobStatus(job.id, v as "open" | "closed")}
                          aria-label={`Status of ${job.title}`}
                          options={[
                            { value: "open", label: "Open" },
                            { value: "closed", label: "Closed" },
                          ]}
                        />
                        <ConfirmDelete title={`Delete “${job.title}”?`} description="Its candidates are deleted too." onConfirm={() => removeJob(job.id)} />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="candidates" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {selectedJob ? (
              <Button variant="link" className="px-0" onClick={() => setSelectedJobId(null)}>
                ← All candidates (showing {selectedJob.title})
              </Button>
            ) : (
              <span />
            )}
            {canEditCandidates && (
              <Button onClick={() => setCandidateFormOpen(true)} disabled={jobs.length === 0}>
                <Plus /> Add candidate
              </Button>
            )}
          </div>
          {visibleCandidates.length === 0 ? (
            <EmptyState icon={Users} title="No candidates yet" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {CANDIDATE_STAGES.map((stage) => {
                const inStage = visibleCandidates.filter((c) => c.stage === stage.key);
                return (
                  <section key={stage.key} className="flex min-w-0 flex-col gap-2" aria-label={stage.label}>
                    <div className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {stage.label} ({inStage.length})
                    </div>
                    {inStage.map((c) => (
                      <Card key={c.id} className="gap-2 py-3 text-sm">
                        <CardContent className="flex flex-col gap-2">
                          <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.job_title}</div>
                            {c.email && <div className="truncate text-xs text-muted-foreground">{c.email}</div>}
                            {c.resume_url && (
                              <a href={c.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                Resume <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                          {canEditCandidates && (
                            <SelectField
                              size="sm"
                              value={c.stage}
                              onValueChange={(v) => setStage(c.id, v as CandidateStage)}
                              aria-label={`Stage of ${c.name}`}
                              options={CANDIDATE_STAGES.map((s) => ({ value: s.key, label: s.label }))}
                            />
                          )}
                          {canManage && (
                            <div className="flex items-center justify-between">
                              {c.stage === "hired" ? (
                                <Button variant="ghost" size="xs" className="text-success" onClick={() => convertToEmployee(c.id)}>
                                  <UserCheck /> Add to employees
                                </Button>
                              ) : (
                                <span />
                              )}
                              <ConfirmDelete title={`Remove ${c.name}?`} onConfirm={() => removeCandidate(c.id)} label="Remove" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <JobFormDialog open={jobFormOpen} onOpenChange={setJobFormOpen} />
      <CandidateFormDialog open={candidateFormOpen} onOpenChange={setCandidateFormOpen} jobs={jobs} defaultJobId={selectedJobId} />
    </div>
  );
}
