"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cycleSchema, type CycleInput } from "@/lib/schemas/performance";
import { usePerformanceStore } from "@/stores/performance-store";
import { FormDatePicker } from "@/components/common/date-picker";
import { FORM_DIALOG, FormGrid } from "@/components/common/form-layout";

export function CycleFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const addCycle = usePerformanceStore((s) => s.addCycle);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CycleInput>({
    resolver: zodResolver(cycleSchema),
    defaultValues: { name: "", startDate: "", endDate: "" },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  async function onSubmit(values: CycleInput) {
    if (await addCycle(values)) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>New review cycle</DialogTitle>
        </DialogHeader>
        <form id="cycle-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            <FormField label="Cycle name" htmlFor="cy-name" error={errors.name}>
              <Input id="cy-name" placeholder="e.g. Q4 2026" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Start date" htmlFor="cy-start" error={errors.startDate}>
              <FormDatePicker control={control} name="startDate" id="cy-start" />
            </FormField>
            <FormField label="End date" htmlFor="cy-end" error={errors.endDate}>
              <FormDatePicker control={control} name="endDate" id="cy-end" />
            </FormField>
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="cycle-form" disabled={isSubmitting}>
            Create cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
