"use client";

// One candidate: profile + resume + timeline, interviews with feedback, offer letter and hiring
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ExternalLink, FileText, FileUp, MessageSquarePlus, Pencil, Send, UserCheck, XCircle } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { PersonAvatar } from "@/components/common/person-avatar";
import { SelectField } from "@/components/common/select-field";
import { StarRating } from "@/components/common/star-rating";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDate, fmtDateTime, inr, isoDate, timeAgo } from "@/lib/format";
import { recruitmentService } from "@/lib/services/recruitment";
import type { CandidateDetail, CandidateStage, Interview, JobPosting } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { CandidateDialog } from "./candidate-dialog";
import { FeedbackDialog, ScheduleDialog } from "./interview-dialogs";
import { MODES, OFFER_STATUS, RECOMMEND, SOURCES, STAGES, lakhs, stageOf } from "./labels";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

function OfferForm({ d, onSaved }: { d: CandidateDetail; onSaved: (x: CandidateDetail) => void }) {
  const o = d.offer;
  const [f, setF] = useState(() => ({
    designation: o?.designation ?? d.candidate.job_title,
    department: o?.department ?? "",
    ctcAnnual: o ? String(Number(o.ctc_annual)) : d.candidate.expected_ctc ? String(Number(d.candidate.expected_ctc)) : "",
    joiningDate: o?.joining_date ?? isoDate(new Date(Date.now() + 30 * 86400000)),
    expiresOn: o?.expires_on ?? isoDate(new Date(Date.now() + 7 * 86400000)),
    workLocation: o?.work_location ?? "",
    probationMonths: o?.probation_months != null ? String(o.probation_months) : "6",
    notes: o?.notes ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const locked = o && (o.status === "accepted" || o.status === "declined");
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    const r = await run(() => recruitmentService.saveOffer(d.candidate.id, { ...f, ctcAnnual: Number(f.ctcAnnual), probationMonths: f.probationMonths === "" ? null : Number(f.probationMonths), expiresOn: f.expiresOn || null }), { success: "Offer saved" });
    setBusy(false);
    if (r.ok) onSaved(r.data);
  }

  return (
    <FormGrid density="dialog">
      <FormField label="Designation" htmlFor="of-des" required span="md">
        <Input id="of-des" value={f.designation} onChange={(e) => set("designation")(e.target.value)} disabled={Boolean(locked)} />
      </FormField>
      <FormField label="Department" htmlFor="of-dep" span="md">
        <Input id="of-dep" value={f.department} onChange={(e) => set("department")(e.target.value)} disabled={Boolean(locked)} />
      </FormField>
      <FormField label="CTC per year (₹)" htmlFor="of-ctc" required span="md" description={Number(f.ctcAnnual) ? `${inr(Math.round(Number(f.ctcAnnual) / 12))} a month` : undefined}>
        <Input id="of-ctc" type="number" min={1} value={f.ctcAnnual} onChange={(e) => set("ctcAnnual")(e.target.value)} disabled={Boolean(locked)} />
      </FormField>
      <FormField label="Joining date" htmlFor="of-join" required span="md">
        <DatePicker id="of-join" value={f.joiningDate} onChange={set("joiningDate")} disabled={Boolean(locked)} />
      </FormField>
      <FormField label="Accept by" htmlFor="of-exp" span="md">
        <DatePicker id="of-exp" value={f.expiresOn} onChange={set("expiresOn")} clearable disabled={Boolean(locked)} />
      </FormField>
      <FormField label="Probation (months)" htmlFor="of-prob" span="md">
        <Input id="of-prob" type="number" min={0} max={24} value={f.probationMonths} onChange={(e) => set("probationMonths")(e.target.value)} disabled={Boolean(locked)} />
      </FormField>
      <FormField label="Work location" htmlFor="of-loc" span="full">
        <Input id="of-loc" value={f.workLocation} onChange={(e) => set("workLocation")(e.target.value)} disabled={Boolean(locked)} />
      </FormField>
      <FormField label="Extra terms (printed on the letter)" htmlFor="of-notes" span="full">
        <Textarea id="of-notes" rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} disabled={Boolean(locked)} />
      </FormField>
      {!locked && (
        <div className="col-span-12">
          <Button onClick={save} disabled={busy || !f.designation.trim() || !(Number(f.ctcAnnual) > 0) || !f.joiningDate}>
            {busy && <Spinner />} {o ? "Update offer" : "Create offer"}
          </Button>
        </div>
      )}
    </FormGrid>
  );
}

export function CandidatePanel({ candidateId, jobs, onClose, onChanged }: { candidateId: number | null; jobs: JobPosting[]; onClose: () => void; onChanged: () => void }) {
  const can = useCan();
  const canEdit = can("recruitment.candidates");
  const canManage = can("recruitment.manage");
  const [d, setD] = useState<CandidateDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (candidateId == null) return;
    let cancelled = false;
    run(() => recruitmentService.candidate(candidateId)).then((r) => !cancelled && r.ok && setD(r.data));
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  function changed(x: CandidateDetail) {
    setD(x);
    onChanged();
  }

  async function act(key: string, fn: () => Promise<CandidateDetail>, success: string) {
    setBusy(key);
    const r = await run(fn, { success });
    setBusy(null);
    if (r.ok) changed(r.data);
    return r.ok;
  }

  async function reload() {
    if (candidateId == null) return;
    const r = await run(() => recruitmentService.candidate(candidateId), { silent: true });
    if (r.ok) changed(r.data);
  }

  async function openResume() {
    if (!d) return;
    const tab = window.open("", "_blank");
    const r = await run(() => recruitmentService.resumeLink(d.candidate.id));
    if (r.ok && tab) tab.location.href = r.data;
    else tab?.close();
  }

  async function hire() {
    if (!d || !window.confirm(`Hire ${d.candidate.name}? An employee record is created${d.offer ? ` with joining date ${fmtDate(d.offer.joining_date)}` : ""}.`)) return;
    setBusy("hire");
    const r = await run(() => recruitmentService.hire(d.candidate.id), { success: "Hired — employee record created" });
    setBusy(null);
    if (r.ok) await reload();
  }

  const c = d?.candidate;
  const done = c?.stage === "hired" || c?.stage === "rejected";

  return (
    <Sheet
      open={candidateId != null}
      onOpenChange={(o) => {
        if (!o) {
          setD(null);
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {!d || !c ? (
          <div className="flex flex-col gap-3 p-6">
            <SheetTitle className="sr-only">Candidate</SheetTitle>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-start gap-3 pr-8">
                <PersonAvatar name={c.name} className="size-12" />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-lg">{c.name}</SheetTitle>
                  <SheetDescription className="truncate">
                    {c.job_title} · applied {fmtDate(c.applied_date)}
                    {c.source && ` · ${SOURCES[c.source]}`}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={stageOf(c.stage).tone}>{stageOf(c.stage).label}</StatusBadge>
                    {c.rating && <StarRating value={c.rating} readOnly />}
                    {c.avg_score && <span className="text-xs text-muted-foreground">Interview score {c.avg_score}/5</span>}
                  </div>
                </div>
              </div>
              {/* Stage actions */}
              {canEdit && !done && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <SelectField
                    className="w-44"
                    size="sm"
                    value={c.stage}
                    onValueChange={(v) => (v === "rejected" ? setRejecting(true) : act("stage", () => recruitmentService.setStage(c.id, v as CandidateStage), `Moved to ${stageOf(v as CandidateStage).label}`))}
                    options={STAGES.filter((s) => s.key !== "hired").map((s) => ({ value: s.key, label: `Move to: ${s.label}` }))}
                    aria-label="Stage"
                  />
                  <Button size="sm" variant="outline" onClick={() => setScheduling(true)}>
                    <CalendarPlus /> Interview
                  </Button>
                  {canManage && (
                    <Button size="sm" disabled={busy !== null} onClick={hire}>
                      {busy === "hire" ? <Spinner /> : <UserCheck />} Hire
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejecting(true)}>
                    <XCircle /> Reject
                  </Button>
                </div>
              )}
              {rejecting && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                  <Input className="h-8 flex-1" autoFocus placeholder="Why? (e.g. Skills don't match)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Rejection reason" />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!reason.trim() || busy !== null}
                    onClick={async () => (await act("stage", () => recruitmentService.setStage(c.id, "rejected", reason.trim()), "Candidate rejected")) && (setRejecting(false), setReason(""))}
                  >
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                    Cancel
                  </Button>
                </div>
              )}
              {c.stage === "rejected" && c.rejection_reason && <p className="mt-2 text-sm text-destructive">Rejected: {c.rejection_reason}</p>}
              {c.hired_employee_id && (
                <Link href={`/employees/${c.hired_employee_id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Open employee profile <ExternalLink className="size-3.5" />
                </Link>
              )}
            </SheetHeader>

            <Tabs defaultValue="profile" className="p-5">
              <TabsList className="w-full">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="interviews">Interviews ({d.interviews.length})</TabsTrigger>
                <TabsTrigger value="offer">Offer{d.offer ? ` · ${OFFER_STATUS[d.offer.status].label}` : ""}</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil /> Edit details
                    </Button>
                  )}
                  {c.resume_name ? (
                    <Button size="sm" variant="outline" onClick={openResume}>
                      <FileText /> {c.resume_name}
                    </Button>
                  ) : (
                    <span className="self-center text-sm text-muted-foreground">No resume yet</span>
                  )}
                  {canEdit && (
                    <>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.doc,.docx,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void act("resume", () => recruitmentService.uploadResume(c.id, file), "Resume uploaded");
                          e.target.value = "";
                        }}
                      />
                      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
                        {busy === "resume" ? <Spinner /> : <FileUp />} {c.resume_name ? "Replace" : "Upload resume"}
                      </Button>
                    </>
                  )}
                </div>
                <div className="divide-y rounded-lg border px-3">
                  <Row label="Email" value={c.email} />
                  <Row label="Phone" value={c.phone} />
                  <Row label="Location" value={c.location} />
                  <Row label="Current company" value={c.current_company} />
                  <Row label="Experience" value={c.experience_years && `${Number(c.experience_years)} yrs`} />
                  <Row label="Current / expected CTC" value={`${lakhs(c.current_ctc)} → ${lakhs(c.expected_ctc)}`} />
                  <Row label="Notice period" value={c.notice_days != null && `${c.notice_days} days`} />
                  {c.notes && <Row label="Notes" value={c.notes} />}
                </div>

                {canEdit && (
                  <div className="flex gap-2">
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (call summary, follow-up…)" aria-label="New note" />
                    <Button className="self-end" disabled={!note.trim() || busy !== null} onClick={async () => (await act("note", () => recruitmentService.addNote(c.id, note.trim()), "Note added")) && setNote("")}>
                      <MessageSquarePlus />
                    </Button>
                  </div>
                )}
                <ol className="relative ml-2 border-l pl-4">
                  {d.events.map((e) => (
                    <li key={e.id} className="mb-3">
                      <span className={cn("absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background", e.kind === "note" ? "bg-slate-400" : e.kind === "interview" ? "bg-amber-500" : e.kind === "offer" ? "bg-violet-500" : "bg-primary")} />
                      <p className="text-sm whitespace-pre-line">{e.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.by ?? "System"} · {timeAgo(e.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              </TabsContent>

              <TabsContent value="interviews" className="mt-4 flex flex-col gap-3">
                {canEdit && !done && (
                  <Button size="sm" className="self-start" onClick={() => setScheduling(true)}>
                    <CalendarPlus /> Schedule interview
                  </Button>
                )}
                {!d.interviews.length && <p className="text-sm text-muted-foreground">No interviews yet.</p>}
                {d.interviews.map((i) => (
                  <div key={i.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{i.round_name}</p>
                      <StatusBadge tone={i.status === "completed" ? "success" : i.status === "scheduled" ? "info" : "neutral"}>{i.status === "no_show" ? "No-show" : i.status[0].toUpperCase() + i.status.slice(1)}</StatusBadge>
                    </div>
                    <p className="text-muted-foreground">
                      {fmtDateTime(i.scheduled_at)} · {i.duration_min} min · {MODES[i.mode]} · {i.interviewer_name}
                    </p>
                    {i.location && (
                      <p className="truncate text-xs">
                        {/^https?:\/\//.test(i.location) ? (
                          <a href={i.location} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {i.location}
                          </a>
                        ) : (
                          i.location
                        )}
                      </p>
                    )}
                    {i.status === "completed" && (
                      <div className="mt-2 rounded-md bg-muted/50 p-2">
                        <div className="flex items-center gap-2">
                          <StarRating value={i.rating} readOnly />
                          {i.recommendation && <StatusBadge tone={RECOMMEND[i.recommendation].tone}>{RECOMMEND[i.recommendation].label}</StatusBadge>}
                        </div>
                        <p className="mt-1 whitespace-pre-line">{i.feedback}</p>
                      </div>
                    )}
                    {i.status === "scheduled" && canEdit && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setFeedbackFor({ ...i, candidate_name: c.name })}>
                          Add feedback
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => act("iv", () => recruitmentService.updateInterview(i.id, { status: "no_show" }), "Marked as no-show")}>
                          No-show
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act("iv", () => recruitmentService.updateInterview(i.id, { status: "cancelled" }), "Interview cancelled")}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="offer" className="mt-4 flex flex-col gap-4">
                {d.offer && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                    <StatusBadge tone={OFFER_STATUS[d.offer.status].tone}>{OFFER_STATUS[d.offer.status].label}</StatusBadge>
                    <span className="text-sm text-muted-foreground">
                      {d.offer.sent_at && `sent ${fmtDate(d.offer.sent_at)}`}
                      {d.offer.responded_at && ` · answered ${fmtDate(d.offer.responded_at)}`}
                    </span>
                    <span className="flex-1" />
                    <Button size="sm" variant="outline" onClick={() => run(() => recruitmentService.offerPdf(c.id))}>
                      <FileText /> Offer letter
                    </Button>
                    {canManage && d.offer.status === "draft" && (
                      <Button size="sm" onClick={() => act("offer", () => recruitmentService.setOfferStatus(c.id, "sent"), "Marked as sent")}>
                        <Send /> Mark as sent
                      </Button>
                    )}
                    {canManage && d.offer.status === "sent" && (
                      <>
                        <Button size="sm" onClick={() => act("offer", () => recruitmentService.setOfferStatus(c.id, "accepted"), "Offer accepted")}>
                          Accepted
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => act("offer", () => recruitmentService.setOfferStatus(c.id, "declined"), "Offer declined")}>
                          Declined
                        </Button>
                      </>
                    )}
                    {canManage && d.offer.status === "accepted" && !c.hired_employee_id && (
                      <Button size="sm" onClick={hire} disabled={busy !== null}>
                        <UserCheck /> Hire now
                      </Button>
                    )}
                  </div>
                )}
                {canManage && !done ? <OfferForm key={d.offer?.status ?? "new"} d={d} onSaved={changed} /> : !d.offer && <p className="text-sm text-muted-foreground">No offer.</p>}
              </TabsContent>
            </Tabs>

            <CandidateDialog open={editing} candidate={c} jobs={jobs} onClose={() => setEditing(false)} onSaved={changed} />
            <ScheduleDialog candidateId={scheduling ? c.id : null} roundNo={d.interviews.length + 1} onClose={() => setScheduling(false)} onDone={changed} />
            <FeedbackDialog interview={feedbackFor} onClose={() => setFeedbackFor(null)} onDone={reload} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
