"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { candidateSchema, type CandidateForm, type CandidatePayload } from "@/lib/schemas/recruitment";
import type { Id, JobPosting } from "@/lib/types";
import { useRecruitmentStore } from "@/stores/recruitment-store";
import { FormSelect } from "@/components/common/select-field";

export function CandidateFormDialog({ open, onOpenChange, jobs, defaultJobId }: { open: boolean; onOpenChange: (open: boolean) => void; jobs: JobPosting[]; defaultJobId: Id | null }) {
  const addCandidate = useRecruitmentStore((s) => s.addCandidate);
  const defaults: CandidateForm = { jobPostingId: String(defaultJobId ?? jobs[0]?.id ?? ""), name: "", email: "", phone: "", resumeUrl: "", notes: "" };
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CandidateForm, unknown, CandidatePayload>({ resolver: zodResolver(candidateSchema), defaultValues: defaults });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(payload: CandidatePayload) {
    if (await addCandidate(payload)) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
        </DialogHeader>
        <form id="candidate-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Job posting" htmlFor="cand-job" error={errors.jobPostingId} className="sm:col-span-2">
            <FormSelect control={control} name="jobPostingId" id="cand-job" placeholder="Choose a job" options={jobs.map((j) => ({ value: String(j.id), label: j.title }))} />
          </FormField>
          <FormField label="Candidate name" htmlFor="cand-name" error={errors.name} className="sm:col-span-2">
            <Input id="cand-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
          </FormField>
          <FormField label="Email" htmlFor="cand-email" error={errors.email}>
            <Input id="cand-email" type="email" {...register("email")} />
          </FormField>
          <FormField label="Phone" htmlFor="cand-phone" error={errors.phone}>
            <Input id="cand-phone" type="tel" {...register("phone")} />
          </FormField>
          <FormField label="Resume link" htmlFor="cand-resume" error={errors.resumeUrl} className="sm:col-span-2">
            <Input id="cand-resume" type="url" placeholder="https://…" {...register("resumeUrl")} />
          </FormField>
          <FormField label="Notes" htmlFor="cand-notes" className="sm:col-span-2">
            <Textarea id="cand-notes" rows={3} {...register("notes")} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="candidate-form" disabled={isSubmitting || jobs.length === 0}>
            Add candidate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
