"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PartyPopper, Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, weekday } from "@/lib/format";
import { holidaySchema, type HolidayInput } from "@/lib/schemas/holiday";
import { useHolidaysStore } from "@/stores/holidays-store";
import { FormDatePicker } from "@/components/common/date-picker";

// HR / superadmin set company holidays — they show on everyone's attendance calendar
export function HolidaysView() {
  const holidays = useHolidaysStore((s) => s.list);
  const load = useHolidaysStore((s) => s.load);
  const add = useHolidaysStore((s) => s.add);
  const remove = useHolidaysStore((s) => s.remove);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HolidayInput>({ resolver: zodResolver(holidaySchema), defaultValues: { date: "", name: "" } });

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values: HolidayInput) {
    if (await add(values)) reset();
  }

  return (
    <div>
      <PageHeader title="Holidays" description="Holidays added here appear on everyone's attendance calendar." />
      <FormCard title="Add holiday" crumbs={["Master", "Holidays"]} icon={PartyPopper} className="mb-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Date" htmlFor="hol-date" error={errors.date}>
              <FormDatePicker control={control} name="date" id="hol-date" />
            </FormField>
            <FormField label="Holiday name" htmlFor="hol-name" error={errors.name} span="md">
              <Input id="hol-name" placeholder="e.g. Diwali" {...register("name")} />
            </FormField>
            <FormActions>
              <Button type="submit" disabled={isSubmitting}>
                <Plus /> Add holiday
              </Button>
            </FormActions>
          </FormGrid>
        </form>
      </FormCard>

      {holidays.length === 0 ? (
        <EmptyState icon={PartyPopper} title="No holidays added yet" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="tabular-nums">{fmtDate(h.date)}</TableCell>
                  <TableCell>{weekday(h.date)}</TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>
                    <ConfirmDelete title={`Remove ${h.name}?`} onConfirm={() => remove(h.id)} label="Remove" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
