"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isoDate } from "@/lib/format";
import { salaryStructureSchema, type SalaryStructureForm } from "@/lib/schemas/payroll";
import type { Employee, SalaryStructure } from "@/lib/types";
import { usePayrollStore } from "@/stores/payroll-store";
import { FormDatePicker } from "@/components/common/date-picker";

type StructureOutput = z.output<typeof salaryStructureSchema>;

export function SalaryStructureDialog({ employee, structure, onClose }: { employee: Employee | null; structure?: SalaryStructure; onClose: () => void }) {
  const setStructure = usePayrollStore((s) => s.setStructure);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SalaryStructureForm, unknown, StructureOutput>({ resolver: zodResolver(salaryStructureSchema) });

  useEffect(() => {
    if (employee) {
      reset({
        basic: structure?.basic ?? "",
        hra: structure?.hra ?? "",
        allowances: structure?.allowances ?? "",
        effectiveFrom: isoDate(new Date()),
      });
    }
  }, [employee, structure, reset]);

  async function onSubmit(values: StructureOutput) {
    if (employee && (await setStructure({ ...values, employeeId: employee.id }))) onClose();
  }

  return (
    <Dialog open={Boolean(employee)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salary structure</DialogTitle>
          <DialogDescription>{employee?.name} — a new structure applies from its effective date; older ones stay in history.</DialogDescription>
        </DialogHeader>
        <form id="structure-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField label="Basic (₹ / month)" htmlFor="ss-basic" error={errors.basic}>
            <Input id="ss-basic" type="number" min={0} inputMode="decimal" aria-invalid={Boolean(errors.basic)} {...register("basic")} />
          </FormField>
          <FormField label="HRA (₹ / month)" htmlFor="ss-hra" error={errors.hra}>
            <Input id="ss-hra" type="number" min={0} inputMode="decimal" {...register("hra")} />
          </FormField>
          <FormField label="Other allowances (₹ / month)" htmlFor="ss-allow" error={errors.allowances}>
            <Input id="ss-allow" type="number" min={0} inputMode="decimal" {...register("allowances")} />
          </FormField>
          <FormField label="Effective from" htmlFor="ss-from" error={errors.effectiveFrom}>
            <FormDatePicker control={control} name="effectiveFrom" id="ss-from" />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="structure-form" disabled={isSubmitting}>
            Save structure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
