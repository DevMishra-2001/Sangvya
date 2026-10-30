"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Save, Timer } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { FormSelect } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMinutes } from "@/lib/format";
import { shiftSchema, type ShiftForm, type ShiftPayload } from "@/lib/schemas/shift";
import type { Shift } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useShiftsStore } from "@/stores/shifts-store";

const EMPTY: ShiftForm = { name: "", startTime: "09:00", endTime: "18:00", graceMinutes: "10", breakMinutes: "60", isDefault: "no", isActive: "active" };
const toForm = (s: Shift): ShiftForm => ({
  name: s.name,
  startTime: s.start_time,
  endTime: s.end_time,
  graceMinutes: String(s.grace_minutes),
  breakMinutes: String(s.break_minutes),
  isDefault: s.is_default ? "yes" : "no",
  isActive: s.is_active ? "active" : "inactive",
});

// The company's shifts: working hours, grace time for late marks, break limit.
export function ShiftsView() {
  const list = useShiftsStore((s) => s.list);
  const load = useShiftsStore((s) => s.load);
  const save = useShiftsStore((s) => s.save);
  const remove = useShiftsStore((s) => s.remove);
  const [editing, setEditing] = useState<Shift | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ShiftForm, unknown, ShiftPayload>({ resolver: zodResolver(shiftSchema), defaultValues: EMPTY });

  useEffect(() => {
    load();
  }, [load]);

  function fill(values: ShiftForm) {
    clearErrors();
    for (const [key, value] of Object.entries(values)) setValue(key as keyof ShiftForm, value as never);
  }

  function startEdit(s: Shift) {
    setEditing(s);
    fill(toForm(s));
    setTimeout(() => setFocus("name", { shouldSelect: true }), 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    fill(EMPTY);
  }

  async function onSubmit(payload: ShiftPayload) {
    if (await save(editing?.id ?? null, payload)) cancelEdit();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Shifts"
        description="Working hours for your people. Checking in after the start plus the grace time is marked late; a day shorter than the shift is a short day."
        className="mb-0"
      />

      <FormCard title={editing ? `Edit “${editing.name}”` : "New shift"} crumbs={["Master", "Shifts"]} icon={Timer}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Shift name" htmlFor="sh-name" error={errors.name} required>
              <Input id="sh-name" placeholder="e.g. Night shift" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Start" htmlFor="sh-start" error={errors.startTime} required>
              <Input id="sh-start" type="time" aria-invalid={Boolean(errors.startTime)} {...register("startTime")} />
            </FormField>
            <FormField label="End" htmlFor="sh-end" error={errors.endTime} required description="Earlier than the start = overnight">
              <Input id="sh-end" type="time" aria-invalid={Boolean(errors.endTime)} {...register("endTime")} />
            </FormField>
            <FormField label="Grace (minutes)" htmlFor="sh-grace" error={errors.graceMinutes}>
              <Input id="sh-grace" inputMode="numeric" aria-invalid={Boolean(errors.graceMinutes)} {...register("graceMinutes")} />
            </FormField>
            <FormField label="Break allowed (minutes)" htmlFor="sh-break" error={errors.breakMinutes}>
              <Input id="sh-break" inputMode="numeric" aria-invalid={Boolean(errors.breakMinutes)} {...register("breakMinutes")} />
            </FormField>
            <FormField label="Default shift" htmlFor="sh-default" error={errors.isDefault}>
              <FormSelect
                control={control}
                name="isDefault"
                id="sh-default"
                disabled={editing?.is_default}
                options={[
                  { value: "no", label: "No" },
                  { value: "yes", label: "Yes — for everyone without a shift" },
                ]}
              />
            </FormField>
            <FormField label="Status" htmlFor="sh-status" error={errors.isActive}>
              <FormSelect
                control={control}
                name="isActive"
                id="sh-status"
                disabled={editing?.is_default}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </FormField>
            <FormActions>
              <Button type="submit" disabled={isSubmitting}>
                {editing ? <Save /> : <Plus />} {editing ? "Update" : "Add"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </FormActions>
          </FormGrid>
        </form>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`All shifts · ${list.length}`} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead className="w-28">Grace</TableHead>
              <TableHead className="w-28">Break</TableHead>
              <TableHead className="w-28 text-right">Employees</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((s) => (
              <TableRow key={s.id} className={cn(editing?.id === s.id && "bg-primary/8")}>
                <TableCell className={cn("font-medium", !s.is_active && "text-muted-foreground")}>
                  <span className="flex items-center gap-2">
                    {s.name}
                    {s.is_default && <Badge variant="outline">Default</Badge>}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {s.start_time} – {s.end_time}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {fmtMinutes(s.hours_minutes)}
                    {s.end_time < s.start_time && " · overnight"}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{s.grace_minutes} min</TableCell>
                <TableCell className="tabular-nums">{fmtMinutes(s.break_minutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{s.is_default ? `${s.employee_count} + others` : s.employee_count}</TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? "default" : "secondary"} className="w-16 justify-center">
                    {s.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(s)} aria-label={`Edit ${s.name}`}>
                      <Pencil />
                    </Button>
                    {!s.is_default && (
                      <ConfirmDelete
                        title={`Remove “${s.name}”?`}
                        description={s.employee_count ? `${s.employee_count} employee${s.employee_count === 1 ? "" : "s"} will follow the default shift.` : undefined}
                        onConfirm={async () => {
                          if (editing?.id === s.id) cancelEdit();
                          await remove(s.id);
                        }}
                        label="Remove"
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
