"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { FORM_DIALOG, FormGrid } from "@/components/common/form-layout";
import { PasswordHint } from "@/components/common/password-hint";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { employeeSchema, type EmployeeForm, type EmployeePayload } from "@/lib/schemas/employee";
import type { Employee } from "@/lib/types";
import { useDepartmentsStore } from "@/stores/departments-store";
import { useShiftsStore } from "@/stores/shifts-store";
import { useDesignationsStore } from "@/stores/designations-store";
import { useRolesStore } from "@/stores/roles-store";
import { useAuthStore } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { FormSelect } from "@/components/common/select-field";
import { FormDatePicker } from "@/components/common/date-picker";
import { isoDate } from "@/lib/format";
import { EMPLOYMENT_TYPE_OPTIONS } from "@/lib/constants";

// DB rows are snake_case; the form uses camelCase strings
function toForm(emp: Employee | null): EmployeeForm {
  return {
    photoUrl: emp?.photo_url ?? null,
    name: emp?.name ?? "",
    employeeCode: emp?.employee_code ?? "",
    designationId: emp?.designation_id ? String(emp.designation_id) : "",
    roleId: emp?.role_id ? String(emp.role_id) : "",
    departmentId: emp?.department_id ? String(emp.department_id) : "",
    shiftId: emp?.shift_id ? String(emp.shift_id) : "",
    email: emp?.email ?? "",
    dateOfBirth: emp?.date_of_birth?.slice(0, 10) ?? "",
    olQuota: emp?.ol_quota ?? "",
    managerId: emp?.manager_id ? String(emp.manager_id) : "",
    joinDate: emp?.join_date?.slice(0, 10) ?? "",
    salary: emp?.salary ?? "",
    phone: emp?.phone ?? "",
    gender: emp?.gender ?? "",
    address: emp?.address ?? "",
    employmentType: emp?.employment_type ?? "full_time",
    emergencyContactName: emp?.emergency_contact_name ?? "",
    emergencyContactPhone: emp?.emergency_contact_phone ?? "",
    password: "",
    loginAccess: emp?.login_blocked ? "blocked" : "allowed",
  };
}

export function EmployeeFormDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (open: boolean) => void; employee: Employee | null }) {
  const employees = useEmployeesStore((s) => s.list);
  const add = useEmployeesStore((s) => s.add);
  const update = useEmployeesStore((s) => s.update);
  const designations = useDesignationsStore((s) => s.list);
  const loadDesignations = useDesignationsStore((s) => s.load);
  const departments = useDepartmentsStore((s) => s.list);
  const shifts = useShiftsStore((s) => s.list);
  const loadShifts = useShiftsStore((s) => s.load);
  const loadDepartments = useDepartmentsStore((s) => s.load);
  const roles = useRolesStore((s) => s.list);
  const loadRoles = useRolesStore((s) => s.load);
  const [photoUploading, setPhotoUploading] = useState(false);
  // Roles above mine can't be given, and nobody changes their own (the backend checks the same)
  const me = useAuthStore((s) => s.user);
  const myLevel = me?.is_superadmin ? 99 : (me?.role?.level ?? 0);
  const isMe = Boolean(employee && employee.id === me?.employee_id && !me?.is_superadmin);
  // Logins are set here only by people who manage users
  const canManageLogins = Boolean(me?.permissions.includes("users.manage"));
  const hasLogin = Boolean(employee?.has_login);
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
    if (open) {
      loadDesignations();
      loadDepartments();
      loadShifts();
      loadRoles();
    }
  }, [open, loadDesignations, loadDepartments, loadShifts, loadRoles]);

  const password = useWatch({ control, name: "password" });

  async function onSubmit(payload: EmployeePayload) {
    const ok = employee ? await update(employee.id, payload) : await add(payload);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
        </DialogHeader>
        <form id="employee-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            <FormField label="Photo" htmlFor="emp-photo" span="full" float={false}>
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
            <FormField label="Full name" htmlFor="emp-name" error={errors.name} required>
              <Input id="emp-name" autoFocus autoComplete="off" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Employee code" htmlFor="emp-code" error={errors.employeeCode}>
              <Input id="emp-code" autoComplete="off" maxLength={40} placeholder="e.g. IISPL25888" {...register("employeeCode")} />
            </FormField>
            <FormField label="Email" htmlFor="emp-email" error={errors.email}>
              <Input id="emp-email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email")} />
            </FormField>
            <FormField label="Phone" htmlFor="emp-phone" error={errors.phone}>
              <Input id="emp-phone" type="tel" autoComplete="off" placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
            </FormField>
            <FormField label="Date of birth" htmlFor="emp-dob" error={errors.dateOfBirth}>
              <FormDatePicker control={control} name="dateOfBirth" id="emp-dob" max={isoDate(new Date())} dropdowns clearable />
            </FormField>
            <FormField label="Gender" htmlFor="emp-gender" error={errors.gender}>
              <FormSelect
                control={control}
                name="gender"
                id="emp-gender"
                emptyLabel="— Not set —"
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />
            </FormField>
            <FormField
              label="Designation"
              htmlFor="emp-designation"
              error={errors.designationId}
            >
              <FormSelect
                control={control}
                name="designationId"
                id="emp-designation"
                emptyLabel="— None —"
                options={designations.filter((d) => d.id === employee?.designation_id || d.is_active).map((d) => ({ value: String(d.id), label: d.name }))}
              />
            </FormField>
            <FormField label="Role" htmlFor="emp-role" error={errors.roleId} description={isMe ? "Your own role is changed by someone above you" : undefined}>
              <FormSelect
                control={control}
                name="roleId"
                id="emp-role"
                disabled={isMe}
                placeholder="Employee"
                options={roles
                  .filter((r) => r.id === employee?.role_id || (r.is_active && r.key !== "superadmin" && r.level <= myLevel))
                  .map((r) => ({ value: String(r.id), label: r.name }))}
              />
            </FormField>
            <FormField label="Department" htmlFor="emp-department" error={errors.departmentId}>
              <FormSelect
                control={control}
                name="departmentId"
                id="emp-department"
                emptyLabel="— None —"
                options={departments.filter((d) => d.id === employee?.department_id || d.is_active).map((d) => ({ value: String(d.id), label: d.name }))}
              />
            </FormField>
            <FormField label="Reports to (manager)" htmlFor="emp-manager" error={errors.managerId}>
              <FormSelect
                control={control}
                name="managerId"
                id="emp-manager"
                emptyLabel="— None —"
                options={employees.filter((e) => e.id !== employee?.id && (e.status !== "exited" || e.id === employee?.manager_id)).map((e) => ({ value: String(e.id), label: `${e.name}${e.designation ? ` — ${e.designation}` : ""}` }))}
              />
            </FormField>
            <FormField label="Shift" htmlFor="emp-shift" error={errors.shiftId}>
              <FormSelect
                control={control}
                name="shiftId"
                id="emp-shift"
                emptyLabel={`Company default${shifts.find((s) => s.is_default) ? ` (${shifts.find((s) => s.is_default)!.name})` : ""}`}
                options={shifts
                  .filter((s) => s.id === employee?.shift_id || (s.is_active && !s.is_default))
                  .map((s) => ({ value: String(s.id), label: `${s.name} · ${s.start_time}–${s.end_time}` }))}
              />
            </FormField>
            <FormField label="Employment type" htmlFor="emp-type" error={errors.employmentType}>
              <FormSelect control={control} name="employmentType" id="emp-type" options={EMPLOYMENT_TYPE_OPTIONS} />
            </FormField>
            <FormField label="Join date" htmlFor="emp-join" error={errors.joinDate}>
              <FormDatePicker control={control} name="joinDate" id="emp-join" dropdowns clearable />
            </FormField>
            <FormField label="Monthly salary (₹)" htmlFor="emp-salary" error={errors.salary}>
              <Input id="emp-salary" type="number" min={0} inputMode="decimal" {...register("salary")} />
            </FormField>
            <FormField label="Optional leaves (OL) per year" htmlFor="emp-ol" error={errors.olQuota}>
              <Input id="emp-ol" placeholder="Company default" type="number" min={0} max={365} step={0.5} {...register("olQuota")} />
            </FormField>
            <FormField label="Address" htmlFor="emp-address" error={errors.address} span="md">
              <Input id="emp-address" autoComplete="off" placeholder="House, street, city" {...register("address")} />
            </FormField>
            <FormField label="Emergency contact" htmlFor="emp-ec-name" error={errors.emergencyContactName}>
              <Input id="emp-ec-name" autoComplete="off" placeholder="Name and relation" {...register("emergencyContactName")} />
            </FormField>
            <FormField label="Emergency phone" htmlFor="emp-ec-phone" error={errors.emergencyContactPhone}>
              <Input id="emp-ec-phone" type="tel" autoComplete="off" placeholder="+91 98765 43210" aria-invalid={Boolean(errors.emergencyContactPhone)} {...register("emergencyContactPhone")} />
            </FormField>
            {canManageLogins && (
              <>
                <FormField label={hasLogin ? "New temporary password" : "Temporary password"} htmlFor="emp-password" error={errors.password}>
                  <PasswordHint password={password}>
                    <PasswordInput
                      id="emp-password"
                      autoComplete="new-password"
                      placeholder={hasLogin ? "Leave empty to keep" : "Leave empty for no login"}
                      aria-invalid={Boolean(errors.password)}
                      {...register("password")}
                    />
                  </PasswordHint>
                </FormField>
                <FormField label="Login access" htmlFor="emp-access" error={errors.loginAccess}>
                  <FormSelect
                    control={control}
                    name="loginAccess"
                    id="emp-access"
                    disabled={!hasLogin && !password}
                    options={[
                      { value: "allowed", label: "Allowed" },
                      { value: "blocked", label: "Blocked" },
                    ]}
                  />
                </FormField>
                <p className="col-span-12 -mt-2 text-xs text-muted-foreground">
                  {hasLogin
                    ? employee?.login_blocked
                      ? "Their login is blocked — set Login access to Allowed to let them back in."
                      : "They log in with their email. A new password signs them out everywhere, and they must choose their own on next login."
                    : "Set a password and share it with them — they log in with their email and must choose their own password the first time."}
                </p>
              </>
            )}
          </FormGrid>
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
