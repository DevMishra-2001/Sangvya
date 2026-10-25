"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { employeeSchema, type EmployeeForm, type EmployeePayload } from "@/lib/schemas/employee";
import type { Employee } from "@/lib/types";
import { useDesignationsStore } from "@/stores/designations-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { FormSelect } from "@/components/common/select-field";
import { FormDatePicker } from "@/components/common/date-picker";
import { isoDate } from "@/lib/format";

// DB rows are snake_case; the form uses camelCase strings
function toForm(emp: Employee | null): EmployeeForm {
  return {
    photoUrl: emp?.photo_url ?? null,
    name: emp?.name ?? "",
    employeeCode: emp?.employee_code ?? "",
    designationId: emp?.designation_id ? String(emp.designation_id) : "",
    department: emp?.department ?? "",
    email: emp?.email ?? "",
    dateOfBirth: emp?.date_of_birth?.slice(0, 10) ?? "",
    olQuota: emp?.ol_quota ?? "",
    managerId: emp?.manager_id ? String(emp.manager_id) : "",
    joinDate: emp?.join_date?.slice(0, 10) ?? "",
    salary: emp?.salary ?? "",
  };
}

export function EmployeeFormDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (open: boolean) => void; employee: Employee | null }) {
  const employees = useEmployeesStore((s) => s.list);
  const add = useEmployeesStore((s) => s.add);
  const update = useEmployeesStore((s) => s.update);
  const designations = useDesignationsStore((s) => s.list);
  const loadDesignations = useDesignationsStore((s) => s.load);
  const [photoUploading, setPhotoUploading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeForm, unknown, EmployeePayload>({ resolver: zodResolver(employeeSchema), defaultValues: toForm(employee) });

  useEffect(() => {
    if (open) reset(toForm(employee));
  }, [open, employee, reset]);

  useEffect(() => {
    if (open) loadDesignations();
  }, [open, loadDesignations]);

  async function onSubmit(payload: EmployeePayload) {
    const ok = employee ? await update(employee.id, payload) : await add(payload);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
        </DialogHeader>
        <form id="employee-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Photo" htmlFor="emp-photo" className="sm:col-span-2">
            <Controller
              control={control}
              name="photoUrl"
              render={({ field }) => (
                <ImageUpload
                  id="emp-photo"
                  kind="employee-photo"
                  label="Upload employee photo"
                  hint="A clear face photo, up to 5 MB."
                  value={field.value}
                  onChange={field.onChange}
                  onUploadingChange={setPhotoUploading}
                />
              )}
            />
          </FormField>
          <FormField label="Full name" htmlFor="emp-name" error={errors.name} className="sm:col-span-2">
            <Input id="emp-name" autoFocus aria-invalid={Boolean(errors.name)} {...register("name")} />
          </FormField>
          <FormField label="Employee code" htmlFor="emp-code" error={errors.employeeCode}>
            <Input id="emp-code" maxLength={40} placeholder="e.g. IISPL25888" {...register("employeeCode")} />
          </FormField>
          <FormField label="Email" htmlFor="emp-email" error={errors.email}>
            <Input id="emp-email" type="email" {...register("email")} />
          </FormField>
          <FormField
            label="Designation"
            htmlFor="emp-designation"
            error={errors.designationId}
            description={
              <Link href="/designations" className="text-primary hover:underline">
                Manage designations
              </Link>
            }
          >
            <FormSelect control={control} name="designationId" id="emp-designation" emptyLabel="— None —" options={designations.map((d) => ({ value: String(d.id), label: d.name }))} />
          </FormField>
          <FormField label="Department" htmlFor="emp-department" error={errors.department}>
            <Input id="emp-department" {...register("department")} />
          </FormField>
          <FormField label="Reports to (manager)" htmlFor="emp-manager" error={errors.managerId} className="sm:col-span-2">
            <FormSelect
              control={control}
              name="managerId"
              id="emp-manager"
              emptyLabel="— None —"
              options={employees.filter((e) => e.id !== employee?.id).map((e) => ({ value: String(e.id), label: `${e.name}${e.designation ? ` — ${e.designation}` : ""}` }))}
            />
          </FormField>
          <FormField label="Join date" htmlFor="emp-join" error={errors.joinDate}>
            <FormDatePicker control={control} name="joinDate" id="emp-join" dropdowns clearable />
          </FormField>
          <FormField label="Date of birth" htmlFor="emp-dob" error={errors.dateOfBirth}>
            <FormDatePicker control={control} name="dateOfBirth" id="emp-dob" max={isoDate(new Date())} dropdowns clearable />
          </FormField>
          <FormField label="Monthly salary (₹)" htmlFor="emp-salary" error={errors.salary}>
            <Input id="emp-salary" type="number" min={0} inputMode="decimal" {...register("salary")} />
          </FormField>
          <FormField label="Optional leaves (OL) per year" htmlFor="emp-ol" error={errors.olQuota} description="Empty = company default">
            <Input id="emp-ol" type="number" min={0} max={365} step={0.5} {...register("olQuota")} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={isSubmitting || photoUploading}>
            {employee ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
