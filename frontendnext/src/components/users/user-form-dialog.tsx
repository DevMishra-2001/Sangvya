"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { PasswordChecklist } from "@/components/common/password-checklist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/permissions";
import { userSchema, type UserForm, type UserPayload } from "@/lib/schemas/user";
import type { Employee } from "@/lib/types";
import { useUsersStore } from "@/stores/users-store";
import { FormSelect, SelectField } from "@/components/common/select-field";
import { ROLE_LABELS } from "@/lib/constants";

export function UserFormDialog({
  open,
  onOpenChange,
  roles,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  employees: Employee[]; // employees without a login yet
}) {
  const add = useUsersStore((s) => s.add);
  const defaults: UserForm = { employeeId: "", name: "", email: "", password: "", role: roles[roles.length - 1] ?? "employee" };
  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserForm, unknown, UserPayload>({ resolver: zodResolver(userSchema), defaultValues: defaults });

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New user login</DialogTitle>
          <DialogDescription>Link it to an employee so they can punch in, apply leave and see their tickets.</DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField label="Linked employee" htmlFor="user-employee" error={errors.employeeId}>
            <SelectField
              id="user-employee"
              value={employeeId ?? ""}
              onValueChange={pickEmployee}
              emptyLabel="— Not linked —"
              options={employees.map((emp) => ({ value: String(emp.id), label: emp.name }))}
            />
          </FormField>
          <FormField label="Name" htmlFor="user-name" error={errors.name}>
            <Input id="user-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
          </FormField>
          <FormField label="Email" htmlFor="user-email" error={errors.email}>
            <Input id="user-email" type="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
          </FormField>
          <FormField label="Password" htmlFor="user-password" error={errors.password}>
            <Input id="user-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          </FormField>
          <PasswordChecklist password={password} />
          <FormField label="Role" htmlFor="user-role" error={errors.role}>
            <FormSelect control={control} name="role" id="user-role" options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))} />
          </FormField>
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
