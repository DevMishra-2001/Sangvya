"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { APPLY_LEAVE_TYPES, LEAVE_TYPE_LABELS } from "@/lib/constants";
import { HALF_DAY_OPTIONS, leaveSchema, type LeaveForm } from "@/lib/schemas/leave";
import type { Employee } from "@/lib/types";
import { useLeavesStore } from "@/stores/leaves-store";
import { FormSelect } from "@/components/common/select-field";
import { FormDatePicker } from "@/components/common/date-picker";
import { FORM_DIALOG, FormGrid } from "@/components/common/form-layout";

type LeaveOutput = z.output<typeof leaveSchema>;

// employees: list to pick from (HR applying for anyone), or null to apply for yourself
export function LeaveRequestDialog({
  open,
  onOpenChange,
  employees,
  defaultEmployeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[] | null;
  defaultEmployeeId: number | null;
}) {
  const apply = useLeavesStore((s) => s.apply);
  const defaults: LeaveForm = {
    employeeId: employees ? String(defaultEmployeeId ?? employees[0]?.id ?? "") : "",
    fromDate: "",
    toDate: "",
    leaveType: "cl",
    halfDay: "",
    reason: "",
  };
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<LeaveForm, unknown, LeaveOutput>({
    resolver: zodResolver(leaveSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const halfDay = watch("halfDay");

  async function onSubmit(values: LeaveOutput) {
    const ok = await apply({
      ...values,
      employeeId: employees ? values.employeeId : undefined,
    });
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>New leave request</DialogTitle>
          <DialogDescription>Weekly offs and holidays inside the range aren&apos;t counted. A half day counts as 0.5.</DialogDescription>
        </DialogHeader>
        <form id="leave-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            {employees && (
              <FormField label="Employee" htmlFor="lv-employee" error={errors.employeeId}>
                <FormSelect
                  control={control}
                  name="employeeId"
                  id="lv-employee"
                  placeholder="Choose an employee"
                  options={employees.map((e) => ({
                    value: String(e.id),
                    label: e.name,
                  }))}
                />
              </FormField>
            )}
            <FormField label="Duration" htmlFor="lv-half" error={errors.halfDay}>
              <FormSelect control={control} name="halfDay" id="lv-half" options={HALF_DAY_OPTIONS} />
            </FormField>
            <FormField label={halfDay ? "Day" : "From"} htmlFor="lv-from" error={errors.fromDate}>
              <FormDatePicker control={control} name="fromDate" id="lv-from" />
            </FormField>
            {!halfDay && (
              <FormField label="To" htmlFor="lv-to" error={errors.toDate}>
                <FormDatePicker control={control} name="toDate" id="lv-to" />
              </FormField>
            )}
            <FormField label="Type" htmlFor="lv-type" error={errors.leaveType} description="Comp off is earned by checking in on a Sunday or holiday.">
              <FormSelect
                control={control}
                name="leaveType"
                id="lv-type"
                options={APPLY_LEAVE_TYPES.map((t) => ({
                  value: t,
                  label: LEAVE_TYPE_LABELS[t],
                }))}
              />
            </FormField>
            <FormField span="full" label="Reason" htmlFor="lv-reason" error={errors.reason}>
              <Textarea id="lv-reason" rows={3} {...register("reason")} />
            </FormField>
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="leave-form" disabled={isSubmitting}>
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
