"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { FormField } from "@/components/common/form-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { APPLY_LEAVE_TYPES, LEAVE_TYPE_LABELS } from "@/lib/constants";
import { fmtMinutes, fmtTime } from "@/lib/format";
import { dayLeaveSchema, HALF_DAY_OPTIONS } from "@/lib/schemas/leave";
import type { AttendanceDay, Balances, Holiday, ISODate, Leave, WorkRules } from "@/lib/types";
import { useLeavesStore } from "@/stores/leaves-store";
import { FormSelect } from "@/components/common/select-field";
import { FormGrid } from "@/components/common/form-layout";

type DayLeave = z.output<typeof dayLeaveSchema>;

export interface DayInfo {
  date: ISODate;
  day: AttendanceDay | null;
  holiday: Holiday | null;
  leaves: Leave[];
  isSunday: boolean;
}

// One calendar day: what happened, and the form to apply leave for it.
// Off days (Sunday/holiday) need no leave; working one earns a Comp Off automatically.
export function DayDialog({
  info,
  rules,
  balances,
  onClose,
  onApplied,
}: {
  info: DayInfo | null;
  rules: WorkRules;
  balances?: Balances;
  onClose: () => void;
  onApplied: () => void;
}) {
  const apply = useLeavesStore((s) => s.apply);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof dayLeaveSchema>, unknown, DayLeave>({
    resolver: zodResolver(dayLeaveSchema),
    defaultValues: { leaveType: "cl", halfDay: "", reason: "" },
  });

  useEffect(() => {
    if (info) reset({ leaveType: "cl", halfDay: "", reason: "" });
  }, [info, reset]);

  if (!info) return null;
  const { date, day, holiday, isSunday, leaves } = info;
  // isSunday = a weekly off (from the company's working days)
  const offDay = isSunday || Boolean(holiday && !holiday.is_optional);
  const worked = Boolean(day?.punchIn) || day?.status === "present";
  const activeLeave = leaves.find((l) => l.status === "pending" || l.status === "approved");

  let blockedReason: string | null = null;
  if (activeLeave) blockedReason = `A ${LEAVE_TYPE_LABELS[activeLeave.leave_type]} request for this day is already ${activeLeave.status}.`;
  else if (offDay && worked) blockedReason = "You worked on this day off — 1 Comp Off has been added to your balance. Use it on any working day.";
  else if (offDay) blockedReason = isSunday ? "This is a weekly off." : `This day is a holiday (${holiday?.name}).`;

  async function onSubmit(values: DayLeave) {
    if (await apply({ ...values, fromDate: date, toDate: date })) onApplied();
  }

  const title = new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {holiday && <DialogDescription>{holiday.is_optional ? `Optional holiday: ${holiday.name} — take it with your OL` : `Holiday: ${holiday.name}`}</DialogDescription>}
        </DialogHeader>

        {day?.punchIn && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted p-3 text-sm">
            <dt className="text-muted-foreground">Punch in</dt>
            <dd>
              {fmtTime(day.punchIn)}
              {!!day.lateMinutes && <span className="ml-2 text-xs text-warning">Late by {fmtMinutes(day.lateMinutes)}</span>}
            </dd>
            <dt className="text-muted-foreground">Punch out</dt>
            <dd>{fmtTime(day.punchOut)}</dd>
            <dt className="text-muted-foreground">Break</dt>
            <dd className={day.breakMinutes > rules.maxBreakMinutes ? "text-destructive" : undefined}>{fmtMinutes(day.breakMinutes)}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className={day.shortDay ? "text-destructive" : undefined}>{fmtMinutes(day.totalMinutes)}</dd>
          </dl>
        )}

        {leaves.map((l) => (
          <div key={l.id} className="text-sm">
            {LEAVE_TYPE_LABELS[l.leave_type]} — <StatusBadge status={l.status} />
            {l.reason && <p className="mt-0.5 text-xs text-muted-foreground">{l.reason}</p>}
          </div>
        ))}

        {blockedReason ? (
          <p className="text-sm text-muted-foreground">{blockedReason}</p>
        ) : (
          <form id="day-leave-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormGrid density="dialog">
              <FormField label="Leave type" htmlFor="dl-type" error={errors.leaveType}>
                <FormSelect
                  control={control}
                  name="leaveType"
                  id="dl-type"
                  options={APPLY_LEAVE_TYPES.map((t) => ({
                    value: t,
                    label: `${LEAVE_TYPE_LABELS[t]}${balances ? ` — ${balances[t].available} left` : ""}`,
                  }))}
                />
              </FormField>
              <FormField label="Duration" htmlFor="dl-half" error={errors.halfDay}>
                <FormSelect control={control} name="halfDay" id="dl-half" options={HALF_DAY_OPTIONS} />
              </FormField>
              <FormField span="full" label="Description" htmlFor="dl-reason" error={errors.reason}>
                <Textarea id="dl-reason" rows={3} aria-invalid={Boolean(errors.reason)} {...register("reason")} />
              </FormField>
            </FormGrid>
          </form>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {!blockedReason && (
            <Button type="submit" form="day-leave-form" disabled={isSubmitting}>
              {isSubmitting ? "Applying…" : "Apply"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
