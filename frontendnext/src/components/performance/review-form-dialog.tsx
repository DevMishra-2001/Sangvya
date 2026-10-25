"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { StarRating } from "@/components/common/star-rating";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reviewSchema, type ReviewForm } from "@/lib/schemas/performance";
import type { Employee, Id, Review } from "@/lib/types";
import { usePerformanceStore } from "@/stores/performance-store";

export interface ReviewTarget {
  employee: Employee;
  existing?: Review;
}

export function ReviewFormDialog({ target, cycleId, onClose }: { target: ReviewTarget | null; cycleId: Id; onClose: () => void }) {
  const saveReview = usePerformanceStore((s) => s.saveReview);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewForm>({ resolver: zodResolver(reviewSchema) });

  useEffect(() => {
    if (!target) return;
    const r = target.existing;
    reset({
      rating: r?.rating ?? 0,
      strengths: r?.strengths ?? "",
      improvements: r?.improvements ?? "",
      goalsNextCycle: r?.goals_next_cycle ?? "",
      managerComments: r?.manager_comments ?? "",
    });
  }, [target, reset]);

  const save = (status: "draft" | "submitted") =>
    handleSubmit(async (values) => {
      if (target && (await saveReview({ ...values, cycleId, employeeId: target.employee.id, status }))) onClose();
    });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review — {target?.employee.name}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
          <FormField label="Overall rating" error={errors.rating}>
            <Controller name="rating" control={control} render={({ field }) => <StarRating value={field.value} onChange={field.onChange} />} />
          </FormField>
          <FormField label="Strengths" htmlFor="rv-strengths">
            <Textarea id="rv-strengths" rows={2} {...register("strengths")} />
          </FormField>
          <FormField label="Areas for improvement" htmlFor="rv-improvements">
            <Textarea id="rv-improvements" rows={2} {...register("improvements")} />
          </FormField>
          <FormField label="Goals for next cycle" htmlFor="rv-goals">
            <Textarea id="rv-goals" rows={2} {...register("goalsNextCycle")} />
          </FormField>
          <FormField label="Manager comments" htmlFor="rv-comments">
            <Textarea id="rv-comments" rows={2} {...register("managerComments")} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={save("draft")} disabled={isSubmitting}>
            Save draft
          </Button>
          <Button onClick={save("submitted")} disabled={isSubmitting}>
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
