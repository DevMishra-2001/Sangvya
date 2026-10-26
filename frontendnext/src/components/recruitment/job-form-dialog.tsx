"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { jobSchema, type JobForm, type JobInput } from "@/lib/schemas/recruitment";
import { useRecruitmentStore } from "@/stores/recruitment-store";
import { FORM_DIALOG, FormGrid } from "@/components/common/form-layout";

export function JobFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const addJob = useRecruitmentStore((s) => s.addJob);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JobForm, unknown, JobInput>({
    resolver: zodResolver(jobSchema),
    defaultValues: { title: "", department: "", location: "", description: "" },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  async function onSubmit(values: JobInput) {
    if (await addJob(values)) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>New job posting</DialogTitle>
        </DialogHeader>
        <form id="job-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            <FormField label="Job title" htmlFor="job-title" error={errors.title}>
              <Input id="job-title" aria-invalid={Boolean(errors.title)} {...register("title")} />
            </FormField>
            <FormField label="Department" htmlFor="job-dept" error={errors.department}>
              <Input id="job-dept" {...register("department")} />
            </FormField>
            <FormField label="Location" htmlFor="job-loc" error={errors.location}>
              <Input id="job-loc" {...register("location")} />
            </FormField>
            <FormField span="full" label="Description" htmlFor="job-desc">
              <Textarea id="job-desc" rows={4} {...register("description")} />
            </FormField>
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="job-form" disabled={isSubmitting}>
            Post job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
