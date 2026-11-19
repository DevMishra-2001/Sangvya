"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { HALF_DAY_OPTIONS, leaveSchema, type LeaveForm } from "@/lib/schemas/leave";
import type { Employee } from "@/lib/types";
import { useLeavesStore } from "@/stores/leaves-store";
import { useLeaveTypes } from "@/stores/leave-types-store";
import { LeaveDocPicker } from "./leave-doc-picker";
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
  const leaveTypes = useLeaveTypes();
  const [docs, setDocs] = useState<{ path: string; name: string }[]>([]);
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
    if (open) {
      reset(defaults);
      setDocs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const halfDay = watch("halfDay");
  const type = leaveTypes.find(watch("leaveType"));

  async function onSubmit(values: LeaveOutput) {
    const ok = await apply({
      ...values,
      employeeId: employees ? values.employeeId : undefined,
      attachments: docs,
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
              <FormSelect control={control} name="halfDay" id="lv-half" options={type && !type.allow_half_day ? HALF_DAY_OPTIONS.slice(0, 1) : HALF_DAY_OPTIONS} />
            </FormField>
            <FormField label={halfDay ? "Day" : "From"} htmlFor="lv-from" error={errors.fromDate}>
              <FormDatePicker control={control} name="fromDate" id="lv-from" />
            </FormField>
            {!halfDay && (
              <FormField label="To" htmlFor="lv-to" error={errors.toDate}>
                <FormDatePicker control={control} name="toDate" id="lv-to" />
              </FormField>
            )}
            <FormField label="Type" htmlFor="lv-type" error={errors.leaveType} description={type?.kind === "comp_off" ? "Comp off is earned by working a weekly off or holiday." : type && !type.is_paid ? "Unpaid — counted as loss of pay." : undefined}>
              <FormSelect
                control={control}
                name="leaveType"
                id="lv-type"
                options={leaveTypes.applicable.map((t) => ({
                  value: t.code,
                  label: leaveTypes.name(t.code),
                }))}
              />
            </FormField>
            <FormField span="full" label="Reason" htmlFor="lv-reason" error={errors.reason}>
              <Textarea id="lv-reason" rows={3} {...register("reason")} />
            </FormField>
            <div className="col-span-12">
              <LeaveDocPicker files={docs} onChange={setDocs} hint={type?.document_after_days != null ? `Needed for more than ${type.document_after_days} day${type.document_after_days === 1 ? "" : "s"}` : undefined} />
            </div>
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
