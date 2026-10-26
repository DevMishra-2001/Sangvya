"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { PasswordChecklist } from "@/components/common/password-checklist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { userSchema, type UserForm, type UserPayload } from "@/lib/schemas/user";
import type { Employee } from "@/lib/types";
import { useUsersStore } from "@/stores/users-store";
import { SelectField } from "@/components/common/select-field";
import { FORM_DIALOG, FormGrid } from "@/components/common/form-layout";
import { PasswordInput } from "@/components/common/password-input";

export function UserFormDialog({
  open,
  onOpenChange,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[]; // employees without a login yet
}) {
  const add = useUsersStore((s) => s.add);
  const defaults: UserForm = {
    employeeId: "",
    name: "",
    email: "",
    password: "",
  };
  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserForm, unknown, UserPayload>({
    resolver: zodResolver(userSchema),
    defaultValues: defaults,
  });

  const password = useWatch({ control, name: "password" });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Picking an employee pre-fills name/email from their record
  const employeeId = useWatch({ control, name: "employeeId" });
  function pickEmployee(id: string) {
    setValue("employeeId", id, { shouldDirty: true, shouldValidate: true });
    const emp = employees.find((x) => String(x.id) === id);
    if (!emp) return;
    if (!getValues("name")) setValue("name", emp.name);
    if (!getValues("email") && emp.email) setValue("email", emp.email);
  }

  async function onSubmit(payload: UserPayload) {
    if (await add(payload)) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>New user login</DialogTitle>
          <DialogDescription>What they can open comes from the employee&apos;s designation (set it on the Employees page).</DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            <FormField label="Employee" htmlFor="user-employee" error={errors.employeeId} required>
              <SelectField
                id="user-employee"
                value={employeeId ?? ""}
                onValueChange={pickEmployee}
                placeholder="Choose an employee"
                options={employees.map((emp) => ({ value: String(emp.id), label: `${emp.name}${emp.designation ? ` — ${emp.designation}` : ""}` }))}
              />
            </FormField>
            <FormField label="Name" htmlFor="user-name" error={errors.name}>
              <Input id="user-name" autoComplete="off" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Email" htmlFor="user-email" error={errors.email}>
              <Input id="user-email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email")} />
            </FormField>
            <FormField label="Password" htmlFor="user-password" error={errors.password}>
              <PasswordInput id="user-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
            </FormField>
            <PasswordChecklist password={password} className="col-span-12" />
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={isSubmitting}>
            Create login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
