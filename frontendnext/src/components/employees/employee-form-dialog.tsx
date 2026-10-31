"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { FormDatePicker } from "@/components/common/date-picker";
import { FileUpload } from "@/components/common/file-upload";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FORM_DIALOG, FormGrid } from "@/components/common/form-layout";
import { ImageUpload } from "@/components/common/image-upload";
import { PasswordHint } from "@/components/common/password-hint";
import { PasswordInput } from "@/components/common/password-input";
import { FormSelect, SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import { INDIAN_STATES } from "@/lib/company-rules";
import {
  ACCOUNT_TYPE_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RELATION_OPTIONS,
  WORK_MODE_OPTIONS,
} from "@/lib/constants";
import { isoDate } from "@/lib/format";
import { employeeSchema, type EmployeeForm, type EmployeePayload } from "@/lib/schemas/employee";
import { branchesService } from "@/lib/services/branches";
import { employeesService } from "@/lib/services/employees";
import type { Branch, DocumentCategory, Employee, EmployeePrivate } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";
import { useDepartmentsStore } from "@/stores/departments-store";
import { useDesignationsStore } from "@/stores/designations-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { useRolesStore } from "@/stores/roles-store";
import { useShiftsStore } from "@/stores/shifts-store";

const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));

// DB rows are snake_case; the form uses camelCase strings
function toForm(emp: Employee | null, priv: EmployeePrivate | null, privateLoaded: boolean): EmployeeForm {
  return {
    photoUrl: emp?.photo_url ?? null,
    name: emp?.name ?? "",
    employeeCode: str(emp?.employee_code),
    email: str(emp?.email),
    personalEmail: str(emp?.personal_email),
    phone: str(emp?.phone),
    dateOfBirth: emp?.date_of_birth?.slice(0, 10) ?? "",
    gender: str(emp?.gender),
    maritalStatus: str(emp?.marital_status),
    bloodGroup: str(emp?.blood_group),
    nationality: emp ? str(emp.nationality) : "Indian",
    employmentType: emp?.employment_type ?? "full_time",
    joinDate: emp?.join_date?.slice(0, 10) ?? "",
    probationEndDate: emp?.probation_end_date?.slice(0, 10) ?? "",
    workMode: str(emp?.work_mode),
    branchId: str(emp?.branch_id),
    businessUnit: str(emp?.business_unit),
    designationId: str(emp?.designation_id),
    roleId: str(emp?.role_id),
    departmentId: str(emp?.department_id),
    shiftId: str(emp?.shift_id),
    managerId: str(emp?.manager_id),
    salary: str(emp?.salary),
    olQuota: str(emp?.ol_quota),
    address: str(emp?.address),
    addressLine2: str(emp?.address_line2),
    city: str(emp?.city),
    state: str(emp?.state),
    postalCode: str(emp?.postal_code),
    country: emp ? str(emp.country) : "India",
    emergencyContactName: str(emp?.emergency_contact_name),
    emergencyContactRelation: str(emp?.emergency_contact_relation),
    emergencyContactPhone: str(emp?.emergency_contact_phone),
    privateLoaded,
    pan: str(priv?.pan),
    aadhaar: str(priv?.aadhaar),
    uan: str(priv?.uan),
    pfNumber: str(priv?.pf_number),
    esiNumber: str(priv?.esi_number),
    passportNumber: str(priv?.passport_number),
    bankName: str(priv?.bank_name),
    bankBranch: str(priv?.bank_branch),
    ifsc: str(priv?.ifsc),
    accountNumber: str(priv?.account_number),
    accountHolder: str(priv?.account_holder),
    accountType: priv?.account_type ?? "savings",
    password: "",
    loginAccess: emp?.login_blocked ? "blocked" : "allowed",
  };
}

interface QueuedDoc {
  category: DocumentCategory;
  file: File;
}

export function EmployeeFormDialog({ open, onOpenChange: setOpen, employee }: { open: boolean; onOpenChange: (open: boolean) => void; employee: Employee | null }) {
  const employees = useEmployeesStore((s) => s.list);
  const add = useEmployeesStore((s) => s.add);
  const update = useEmployeesStore((s) => s.update);
  const designations = useDesignationsStore((s) => s.list);
  const loadDesignations = useDesignationsStore((s) => s.load);
  const departments = useDepartmentsStore((s) => s.list);
  const loadDepartments = useDepartmentsStore((s) => s.load);
  const shifts = useShiftsStore((s) => s.list);
  const loadShifts = useShiftsStore((s) => s.load);
  const roles = useRolesStore((s) => s.list);
  const loadRoles = useRolesStore((s) => s.load);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [privateFor, setPrivateFor] = useState<number | null>(null); // employee whose ID / bank details are loaded
  const [lookingUp, setLookingUp] = useState(false);
  const [docCategory, setDocCategory] = useState<DocumentCategory>("pan_card");
  const [queued, setQueued] = useState<QueuedDoc[]>([]);
  // Roles above mine can't be given, and nobody changes their own (the backend checks the same)
  const me = useAuthStore((s) => s.user);
  const myLevel = me?.is_superadmin ? 99 : (me?.role?.level ?? 0);
  const isMe = Boolean(employee && employee.id === me?.employee_id && !me?.is_superadmin);
  const canManageLogins = Boolean(me?.permissions.includes("users.manage"));
  const hasLogin = Boolean(employee?.has_login);
  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeForm, unknown, EmployeePayload>({ resolver: zodResolver(employeeSchema), defaultValues: toForm(employee, null, !employee) });

  // Fill the form; for an edit, fetch the statutory / bank details first
  useEffect(() => {
    if (!open) return;
    reset(toForm(employee, null, !employee));
    if (!employee) {
      // New employee: suggest the next code in the company's format
      run(employeesService.nextCode, { silent: true }).then((r) => r.ok && !getValues("employeeCode") && setValue("employeeCode", r.data));
      return;
    }
    let cancelled = false;
    run(() => employeesService.private(employee.id), { silent: true }).then((r) => {
      if (cancelled) return;
      setPrivateFor(employee.id);
      reset(toForm(employee, r.ok ? r.data : null, r.ok));
    });
    return () => {
      cancelled = true;
    };
  }, [open, employee, reset, getValues, setValue]);

  useEffect(() => {
    if (!open) return;
    loadDesignations();
    loadDepartments();
    loadShifts();
    loadRoles();
    run(branchesService.list, { silent: true }).then((r) => r.ok && setBranches(r.data));
  }, [open, loadDesignations, loadDepartments, loadShifts, loadRoles]);

  const loadingPrivate = Boolean(employee) && privateFor !== employee?.id;
  const [password, privateLoaded] = useWatch({ control, name: ["password", "privateLoaded"] });
  const businessUnits = [...new Set(employees.map((e) => e.business_unit).filter((b): b is string => Boolean(b)))];

  // Bank and branch from the IFSC
  async function lookupIfsc() {
    const code = getValues("ifsc").replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) return toast.error("Enter a valid IFSC first, e.g. SBIN0001234");
    setLookingUp(true);
    const r = await run(() => employeesService.ifsc(code));
    setLookingUp(false);
    if (!r.ok) return;
    setValue("bankName", r.data.bank ?? "", { shouldDirty: true });
    setValue("bankBranch", [r.data.branch, r.data.city].filter(Boolean).join(", "), { shouldDirty: true });
  }

  async function onSubmit(payload: EmployeePayload) {
    if (employee) {
      if (await update(employee.id, payload)) onOpenChange(false);
      return;
    }
    const created = await add(payload);
    if (!created) return;
    // Documents picked before saving go up now
    for (const d of queued) {
      try {
        await employeesService.uploadDocument(created.id, d.file, { name: DOCUMENT_CATEGORY_LABELS[d.category], category: d.category });
      } catch (err) {
        toast.error(`${d.file.name}: ${errorMessage(err, "upload failed")}`);
      }
    }
    if (queued.length) toast.success(`${queued.length} document${queued.length === 1 ? "" : "s"} uploaded`);
    onOpenChange(false);
  }

  // Closing drops documents picked but not saved
  function onOpenChange(o: boolean) {
    if (!o) {
      setQueued([]);
      setPrivateFor(null);
    }
    setOpen(o);
  }

  const none = "— None —";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>{employee ? `Edit ${employee.name}` : "Add employee"}</DialogTitle>
        </DialogHeader>
        <form id="employee-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            <FieldSeparator label="Basic information" />
            <FormField label="Photo" htmlFor="emp-photo" span="full" float={false}>
              <Controller
                control={control}
                name="photoUrl"
                render={({ field }) => (
                  <ImageUpload id="emp-photo" kind="employee-photo" round label="Upload employee photo" hint="A clear face photo — JPG or PNG, up to 5 MB." value={field.value} onChange={field.onChange} onUploadingChange={setPhotoUploading} />
                )}
              />
            </FormField>
            <FormField label="Full name" htmlFor="emp-name" error={errors.name} required>
              <Input id="emp-name" autoFocus placeholder="e.g. Priya Sharma" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Employee code" htmlFor="emp-code" error={errors.employeeCode} description={employee ? undefined : "Next free code — change it if needed"}>
              <Input id="emp-code" maxLength={40} placeholder="e.g. EMP001" {...register("employeeCode")} />
            </FormField>
            <FormField label="Work email" htmlFor="emp-email" error={errors.email} description="They log in with this">
              <Input id="emp-email" type="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
            </FormField>
            <FormField label="Personal email" htmlFor="emp-pemail" error={errors.personalEmail}>
              <Input id="emp-pemail" type="email" aria-invalid={Boolean(errors.personalEmail)} {...register("personalEmail")} />
            </FormField>
            <FormField label="Phone" htmlFor="emp-phone" error={errors.phone}>
              <Input id="emp-phone" type="tel" inputMode="tel" maxLength={18} placeholder="98765 43210" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
            </FormField>
            <FormField label="Date of birth" htmlFor="emp-dob" error={errors.dateOfBirth}>
              <FormDatePicker control={control} name="dateOfBirth" id="emp-dob" max={isoDate(new Date())} dropdowns clearable />
            </FormField>
            <FormField label="Gender" htmlFor="emp-gender" error={errors.gender}>
              <FormSelect control={control} name="gender" id="emp-gender" emptyLabel={none} options={GENDER_OPTIONS} />
            </FormField>
            <FormField label="Marital status" htmlFor="emp-marital" error={errors.maritalStatus}>
              <FormSelect control={control} name="maritalStatus" id="emp-marital" emptyLabel={none} options={MARITAL_STATUS_OPTIONS} />
            </FormField>
            <FormField label="Blood group" htmlFor="emp-blood" error={errors.bloodGroup}>
              <FormSelect control={control} name="bloodGroup" id="emp-blood" emptyLabel={none} options={BLOOD_GROUP_OPTIONS} />
            </FormField>
            <FormField label="Nationality" htmlFor="emp-nation" error={errors.nationality}>
              <Input id="emp-nation" {...register("nationality")} />
            </FormField>

            <FieldSeparator label="Employment" />
            <FormField label="Employment type" htmlFor="emp-type" error={errors.employmentType}>
              <FormSelect control={control} name="employmentType" id="emp-type" options={EMPLOYMENT_TYPE_OPTIONS} />
            </FormField>
            <FormField label="Joining date" htmlFor="emp-join" error={errors.joinDate} description="Official date (payroll, leave, letters)">
              <FormDatePicker control={control} name="joinDate" id="emp-join" dropdowns clearable />
            </FormField>
            <FormField label="Probation ends" htmlFor="emp-probation" error={errors.probationEndDate}>
              <FormDatePicker control={control} name="probationEndDate" id="emp-probation" dropdowns clearable />
            </FormField>
            <FormField label="Work mode" htmlFor="emp-mode" error={errors.workMode} description="Office = check-in only inside the branch radius">
              <FormSelect control={control} name="workMode" id="emp-mode" emptyLabel={none} options={WORK_MODE_OPTIONS} />
            </FormField>
            <FormField label="Branch / location" htmlFor="emp-branch" error={errors.branchId}>
              <FormSelect
                control={control}
                name="branchId"
                id="emp-branch"
                emptyLabel={none}
                options={branches.filter((b) => b.id === employee?.branch_id || b.is_active).map((b) => ({ value: String(b.id), label: b.name }))}
              />
            </FormField>
            <FormField label="Business unit" htmlFor="emp-bu" error={errors.businessUnit}>
              <Input id="emp-bu" list="emp-bus" placeholder="e.g. Retail, Enterprise" {...register("businessUnit")} />
              <datalist id="emp-bus">
                {businessUnits.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Department" htmlFor="emp-department" error={errors.departmentId}>
              <FormSelect
                control={control}
                name="departmentId"
                id="emp-department"
                emptyLabel={none}
                options={departments.filter((d) => d.id === employee?.department_id || d.is_active).map((d) => ({ value: String(d.id), label: d.name }))}
              />
            </FormField>
            <FormField label="Designation" htmlFor="emp-designation" error={errors.designationId}>
              <FormSelect
                control={control}
                name="designationId"
                id="emp-designation"
                emptyLabel={none}
                options={designations.filter((d) => d.id === employee?.designation_id || d.is_active).map((d) => ({ value: String(d.id), label: d.name }))}
              />
            </FormField>
            <FormField label="Role" htmlFor="emp-role" error={errors.roleId} description={isMe ? "Your own role is changed by someone above you" : "What they can open and do"}>
              <FormSelect
                control={control}
                name="roleId"
                id="emp-role"
                disabled={isMe}
                placeholder="Employee"
                options={roles
                  .filter((r) => r.id === employee?.role_id || (r.is_active && r.key !== "superadmin" && r.level <= myLevel))
                  .map((r) => ({ value: String(r.id), label: r.company_id ? `${r.name} (custom)` : r.name }))}
              />
            </FormField>
            <FormField label="Reports to" htmlFor="emp-manager" error={errors.managerId}>
              <FormSelect
                control={control}
                name="managerId"
                id="emp-manager"
                emptyLabel={none}
                options={employees.filter((e) => e.id !== employee?.id && (e.status !== "exited" || e.id === employee?.manager_id)).map((e) => ({ value: String(e.id), label: `${e.name}${e.designation ? ` — ${e.designation}` : ""}` }))}
              />
            </FormField>
            <FormField label="Shift" htmlFor="emp-shift" error={errors.shiftId}>
              <FormSelect
                control={control}
                name="shiftId"
                id="emp-shift"
                emptyLabel={`Company default${shifts.find((s) => s.is_default) ? ` (${shifts.find((s) => s.is_default)!.name})` : ""}`}
                options={shifts.filter((s) => s.id === employee?.shift_id || (s.is_active && !s.is_default)).map((s) => ({ value: String(s.id), label: `${s.name} · ${s.start_time}–${s.end_time}` }))}
              />
            </FormField>
            <FormField label="Monthly salary (₹)" htmlFor="emp-salary" error={errors.salary}>
              <Input id="emp-salary" type="number" min={0} inputMode="decimal" {...register("salary")} />
            </FormField>
            <FormField label="Optional leaves (OL) per year" htmlFor="emp-ol" error={errors.olQuota}>
              <Input id="emp-ol" placeholder="Company default" type="number" min={0} max={365} step={0.5} {...register("olQuota")} />
            </FormField>

            <FieldSeparator label="Address" />
            <FormField label="Address line 1" htmlFor="emp-address" error={errors.address} span="md">
              <Input id="emp-address" placeholder="House, street" {...register("address")} />
            </FormField>
            <FormField label="Address line 2" htmlFor="emp-address2" error={errors.addressLine2} span="md">
              <Input id="emp-address2" placeholder="Area, landmark" {...register("addressLine2")} />
            </FormField>
            <FormField label="City" htmlFor="emp-city" error={errors.city}>
              <Input id="emp-city" {...register("city")} />
            </FormField>
            <FormField label="State" htmlFor="emp-state" error={errors.state}>
              <Input id="emp-state" list="emp-states" {...register("state")} />
              <datalist id="emp-states">
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Pincode" htmlFor="emp-pin" error={errors.postalCode}>
              <Input id="emp-pin" inputMode="numeric" maxLength={10} {...register("postalCode")} />
            </FormField>
            <FormField label="Country" htmlFor="emp-country" error={errors.country}>
              <Input id="emp-country" {...register("country")} />
            </FormField>

            <FieldSeparator label="Emergency contact" />
            <FormField label="Contact name" htmlFor="emp-ec-name" error={errors.emergencyContactName}>
              <Input id="emp-ec-name" {...register("emergencyContactName")} />
            </FormField>
            <FormField label="Relationship" htmlFor="emp-ec-rel" error={errors.emergencyContactRelation}>
              <FormSelect control={control} name="emergencyContactRelation" id="emp-ec-rel" emptyLabel={none} options={RELATION_OPTIONS} />
            </FormField>
            <FormField label="Phone" htmlFor="emp-ec-phone" error={errors.emergencyContactPhone}>
              <Input id="emp-ec-phone" type="tel" inputMode="tel" maxLength={18} placeholder="98765 43210" aria-invalid={Boolean(errors.emergencyContactPhone)} {...register("emergencyContactPhone")} />
            </FormField>

            <FieldSeparator label="Statutory (India)" />
            {loadingPrivate ? (
              <p className="col-span-12 flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Loading ID and bank details…
              </p>
            ) : !privateLoaded ? (
              <p className="col-span-12 text-sm text-muted-foreground">ID and bank details couldn&apos;t be loaded — they stay as they are.</p>
            ) : (
              <>
                <FormField label="PAN" htmlFor="emp-pan" error={errors.pan} description="4th letter is P for individuals">
                  <Input id="emp-pan" maxLength={10} placeholder="ABCPE1234F" className="uppercase" aria-invalid={Boolean(errors.pan)} {...register("pan")} />
                </FormField>
                <FormField label="Aadhaar" htmlFor="emp-aadhaar" error={errors.aadhaar}>
                  <Input id="emp-aadhaar" inputMode="numeric" maxLength={14} placeholder="1234 5678 9012" aria-invalid={Boolean(errors.aadhaar)} {...register("aadhaar")} />
                </FormField>
                <FormField label="UAN" htmlFor="emp-uan" error={errors.uan} description="12 digits">
                  <Input id="emp-uan" inputMode="numeric" maxLength={12} aria-invalid={Boolean(errors.uan)} {...register("uan")} />
                </FormField>
                <FormField label="PF number" htmlFor="emp-pf" error={errors.pfNumber}>
                  <Input id="emp-pf" placeholder="MH/BOM/12345/000/1234567" {...register("pfNumber")} />
                </FormField>
                <FormField label="ESI number" htmlFor="emp-esi" error={errors.esiNumber} description="10 to 17 digits">
                  <Input id="emp-esi" inputMode="numeric" maxLength={17} aria-invalid={Boolean(errors.esiNumber)} {...register("esiNumber")} />
                </FormField>
                <FormField label="Passport number" htmlFor="emp-passport" error={errors.passportNumber}>
                  <Input id="emp-passport" maxLength={20} className="uppercase" {...register("passportNumber")} />
                </FormField>

                <FieldSeparator label="Bank account (salary)" />
                <FormField label="IFSC" htmlFor="emp-ifsc" error={errors.ifsc}>
                  <div className="flex gap-2">
                    <Input id="emp-ifsc" maxLength={11} placeholder="SBIN0001234" className="uppercase" aria-invalid={Boolean(errors.ifsc)} {...register("ifsc")} />
                    <Button type="button" variant="outline" onClick={lookupIfsc} disabled={lookingUp} aria-label="Look up the bank from the IFSC">
                      {lookingUp ? <Spinner /> : <Search />} Lookup
                    </Button>
                  </div>
                </FormField>
                <FormField label="Bank name" htmlFor="emp-bank" error={errors.bankName}>
                  <Input id="emp-bank" {...register("bankName")} />
                </FormField>
                <FormField label="Branch" htmlFor="emp-bank-branch" error={errors.bankBranch}>
                  <Input id="emp-bank-branch" {...register("bankBranch")} />
                </FormField>
                <FormField label="Account number" htmlFor="emp-acc" error={errors.accountNumber} description="9 to 18 digits">
                  <Input id="emp-acc" inputMode="numeric" maxLength={22} aria-invalid={Boolean(errors.accountNumber)} {...register("accountNumber")} />
                </FormField>
                <FormField label="Account holder" htmlFor="emp-acc-name" error={errors.accountHolder}>
                  <Input id="emp-acc-name" placeholder="As in the bank" {...register("accountHolder")} />
                </FormField>
                <FormField label="Account type" htmlFor="emp-acc-type" error={errors.accountType}>
                  <FormSelect control={control} name="accountType" id="emp-acc-type" options={ACCOUNT_TYPE_OPTIONS} />
                </FormField>
              </>
            )}

            {canManageLogins && (
              <>
                <FieldSeparator label="Login" />
                <FormField label={hasLogin ? "New temporary password" : "Temporary password"} htmlFor="emp-password" error={errors.password}>
                  <PasswordHint password={password}>
                    <PasswordInput id="emp-password" autoComplete="new-password" placeholder={hasLogin ? "Leave empty to keep" : "Leave empty for no login"} aria-invalid={Boolean(errors.password)} {...register("password")} />
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
                      : "They log in with their work email. A new password signs them out everywhere, and they must choose their own on next login."
                    : "Set a password and share it with them — they log in with their work email and must choose their own password the first time."}
                </p>
              </>
            )}

            <FieldSeparator label="Documents" />
            {employee ? (
              <p className="col-span-12 text-sm text-muted-foreground">Upload and view documents on the profile&apos;s Documents tab.</p>
            ) : (
              <>
                <FormField label="Document type" htmlFor="emp-doc-type">
                  <SelectField id="emp-doc-type" value={docCategory} onValueChange={(v) => setDocCategory(v as DocumentCategory)} options={DOCUMENT_CATEGORY_OPTIONS} />
                </FormField>
                <div className="col-span-12 sm:col-span-8">
                  <FileUpload
                    accept="document"
                    title={`Add ${DOCUMENT_CATEGORY_LABELS[docCategory]}`}
                    hint="PDF, image or Word, up to 10 MB — uploaded when you save."
                    upload={async (file) => {
                      setQueued((q) => [...q, { category: docCategory, file }]);
                    }}
                  />
                </div>
                {queued.length > 0 && (
                  <ul className="col-span-12 flex flex-wrap gap-2">
                    {queued.map((d, i) => (
                      <li key={`${d.file.name}-${i}`} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                        <span className="font-medium">{DOCUMENT_CATEGORY_LABELS[d.category]}</span>
                        <span className="max-w-40 truncate text-muted-foreground">{d.file.name}</span>
                        <button type="button" onClick={() => setQueued((q) => q.filter((_, j) => j !== i))} aria-label={`Remove ${d.file.name}`} className="text-muted-foreground hover:text-destructive">
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={isSubmitting || photoUploading || loadingPrivate}>
            {isSubmitting && <Spinner />} {employee ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
