"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, PartyPopper, Pencil, Plus, Save } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { FormSelect } from "@/components/common/select-field";
import { FormDatePicker } from "@/components/common/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, weekday } from "@/lib/format";
import { holidaySchema, type HolidayForm, type HolidayInput } from "@/lib/schemas/holiday";
import type { Holiday } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useHolidaysStore } from "@/stores/holidays-store";

const EMPTY: HolidayForm = { date: "", name: "", kind: "holiday" };

export function YearSwitch({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon-sm" onClick={() => onChange(year - 1)} aria-label="Previous year">
        <ChevronLeft />
      </Button>
      <span className="w-14 text-center text-sm font-semibold tabular-nums">{year}</span>
      <Button variant="outline" size="icon-sm" onClick={() => onChange(year + 1)} aria-label="Next year">
        <ChevronRight />
      </Button>
    </div>
  );
}

// HR / Admin: the company's holidays.
export function HolidaysView() {
  const year = useHolidaysStore((s) => s.year);
  const holidays = useHolidaysStore((s) => s.list);
  const weeklyOffs = useHolidaysStore((s) => s.weeklyOffs);
  const loaded = useHolidaysStore((s) => s.loaded);
  const load = useHolidaysStore((s) => s.load);
  const save = useHolidaysStore((s) => s.save);
  const remove = useHolidaysStore((s) => s.remove);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<HolidayForm, unknown, HolidayInput>({ resolver: zodResolver(holidaySchema), defaultValues: EMPTY });

  useEffect(() => {
    load();
  }, [load]);

  function fill(v: HolidayForm) {
    clearErrors();
    for (const [k, val] of Object.entries(v)) setValue(k as keyof HolidayForm, val as never);
  }
  function startEdit(h: Holiday) {
    setEditing(h);
    fill({ date: h.date, name: h.name, kind: h.is_optional ? "optional" : "holiday" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditing(null);
    fill(EMPTY);
  }

  async function onSubmit(values: HolidayInput) {
    if (await save(editing?.id ?? null, values)) cancelEdit();
  }

  const fixed = holidays.filter((h) => !h.is_optional).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Holidays"
        description={`Holidays show on everyone's attendance calendar. Optional holidays are working days people can take with their OL.${weeklyOffs.length ? ` Weekly offs: ${weeklyOffs.join(", ")}.` : ""}`}
        className="mb-0"
      />
      <FormCard title={editing ? `Edit “${editing.name}”` : "Add holiday"} crumbs={["Master", "Holidays"]} icon={PartyPopper}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Date" htmlFor="hol-date" error={errors.date} required>
              <FormDatePicker control={control} name="date" id="hol-date" />
            </FormField>
            <FormField label="Holiday name" htmlFor="hol-name" error={errors.name} required span="md">
              <Input id="hol-name" placeholder="e.g. Diwali" {...register("name")} />
            </FormField>
            <FormField label="Type" htmlFor="hol-kind" error={errors.kind}>
              <FormSelect
                control={control}
                name="kind"
                id="hol-kind"
                options={[
                  { value: "holiday", label: "Holiday — office closed" },
                  { value: "optional", label: "Optional — take with OL" },
                ]}
              />
            </FormField>
            <FormActions>
              <Button type="submit" disabled={isSubmitting}>
                {editing ? <Save /> : <Plus />} {editing ? "Update" : "Add holiday"}
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
        <FormHeading title={`${year} · ${fixed} holiday${fixed === 1 ? "" : "s"} · ${holidays.length - fixed} optional`} actions={<YearSwitch year={year} onChange={(y) => load(y)} />} />
        {loaded && holidays.length === 0 ? (
          <EmptyState icon={PartyPopper} title={`No holidays for ${year} yet`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-28">Day</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id} className={cn(editing?.id === h.id && "bg-primary/8")}>
                  <TableCell className="tabular-nums">{fmtDate(h.date)}</TableCell>
                  <TableCell>{weekday(h.date)}</TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {h.name}
                      {h.is_optional && <Badge variant="outline">Optional</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => startEdit(h)} aria-label={`Edit ${h.name}`}>
                        <Pencil />
                      </Button>
                      <ConfirmDelete
                        title={`Remove ${h.name}?`}
                        onConfirm={async () => {
                          if (editing?.id === h.id) cancelEdit();
                          await remove(h.id);
                        }}
                        label="Remove"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
