"use client";

// Add / edit a candidate
import { useEffect, useState } from "react";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { StarRating } from "@/components/common/star-rating";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { recruitmentService } from "@/lib/services/recruitment";
import type { Candidate, CandidateDetail, JobPosting } from "@/lib/types";
import { SOURCES, options } from "./labels";

const EMPTY = { jobPostingId: "", name: "", email: "", phone: "", source: "", currentCompany: "", experienceYears: "", currentCtc: "", expectedCtc: "", noticeDays: "", location: "", notes: "" };
type Form = typeof EMPTY;

export function CandidateDialog({ open, candidate, jobs, defaultJobId, onClose, onSaved }: { open: boolean; candidate: Candidate | null; jobs: JobPosting[]; defaultJobId?: string; onClose: () => void; onSaved: (d: CandidateDetail) => void }) {
  const [f, setF] = useState<Form>(EMPTY);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = (v: string | number | null) => (v == null ? "" : String(Number(v)));
    queueMicrotask(() => {
      setF(
        candidate
          ? {
              jobPostingId: String(candidate.job_posting_id),
              name: candidate.name,
              email: candidate.email ?? "",
              phone: candidate.phone ?? "",
              source: candidate.source ?? "",
              currentCompany: candidate.current_company ?? "",
              experienceYears: s(candidate.experience_years),
              currentCtc: s(candidate.current_ctc),
              expectedCtc: s(candidate.expected_ctc),
              noticeDays: s(candidate.notice_days),
              location: candidate.location ?? "",
              notes: candidate.notes ?? "",
            }
          : { ...EMPTY, jobPostingId: defaultJobId ?? "" },
      );
      setRating(candidate?.rating ?? null);
    });
  }, [open, candidate, defaultJobId]);

  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const input = (k: keyof Form) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k)(e.target.value) });

  async function save() {
    setBusy(true);
    const body = { ...f, jobPostingId: Number(f.jobPostingId), source: f.source || null, rating };
    const r = await run(() => (candidate ? recruitmentService.updateCandidate(candidate.id, body) : recruitmentService.createCandidate(body)), { success: candidate ? "Candidate updated" : "Candidate added" });
    setBusy(false);
    if (!r.ok) return;
    onClose();
    onSaved(r.data);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{candidate ? "Edit candidate" : "Add candidate"}</DialogTitle>
          <DialogDescription>Upload the resume from the candidate&apos;s page after saving.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Job" htmlFor="cd-job" required span="md">
            <SelectField id="cd-job" value={f.jobPostingId} onValueChange={set("jobPostingId")} placeholder="Pick a job" options={jobs.filter((j) => j.status !== "closed" || String(j.id) === f.jobPostingId).map((j) => ({ value: String(j.id), label: j.title }))} />
          </FormField>
          <FormField label="Full name" htmlFor="cd-name" required span="md">
            <Input id="cd-name" {...input("name")} maxLength={150} />
          </FormField>
          <FormField label="Email" htmlFor="cd-email">
            <Input id="cd-email" type="email" {...input("email")} />
          </FormField>
          <FormField label="Phone" htmlFor="cd-phone">
            <Input id="cd-phone" type="tel" {...input("phone")} />
          </FormField>
          <FormField label="Source" htmlFor="cd-src">
            <SelectField id="cd-src" value={f.source} onValueChange={set("source")} emptyLabel="—" options={options(SOURCES)} />
          </FormField>
          <FormField label="Location" htmlFor="cd-loc">
            <Input id="cd-loc" {...input("location")} />
          </FormField>

          <FieldSeparator label="Experience & salary" />
          <FormField label="Current company" htmlFor="cd-co" span="md">
            <Input id="cd-co" {...input("currentCompany")} />
          </FormField>
          <FormField label="Experience (yrs)" htmlFor="cd-exp">
            <Input id="cd-exp" type="number" min={0} step={0.5} {...input("experienceYears")} />
          </FormField>
          <FormField label="Notice period (days)" htmlFor="cd-notice">
            <Input id="cd-notice" type="number" min={0} {...input("noticeDays")} />
          </FormField>
          <FormField label="Current CTC (₹/yr)" htmlFor="cd-cctc">
            <Input id="cd-cctc" type="number" min={0} {...input("currentCtc")} />
          </FormField>
          <FormField label="Expected CTC (₹/yr)" htmlFor="cd-ectc">
            <Input id="cd-ectc" type="number" min={0} {...input("expectedCtc")} />
          </FormField>
          <FormField label="Your rating" htmlFor="cd-rate" float={false}>
            <StarRating value={rating} onChange={setRating} />
          </FormField>
          <FormField label="Notes" htmlFor="cd-notes" span="full">
            <Textarea id="cd-notes" rows={2} {...input("notes")} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !f.name.trim() || !f.jobPostingId}>
            {busy && <Spinner />} {candidate ? "Save" : "Add candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
