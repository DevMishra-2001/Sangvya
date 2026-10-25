"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PartyPopper, Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="mb-6">
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-start gap-3" noValidate>
            <FormField label="Date" htmlFor="hol-date" error={errors.date} className="w-44">
              <FormDatePicker control={control} name="date" id="hol-date" />
            </FormField>
            <FormField label="Name" htmlFor="hol-name" error={errors.name} className="min-w-56 flex-1">
              <Input id="hol-name" placeholder="e.g. Diwali" {...register("name")} />
            </FormField>
            <Button type="submit" className="mt-6" disabled={isSubmitting}>
              <Plus /> Add holiday
            </Button>
          </form>
        </CardContent>
      </Card>

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
