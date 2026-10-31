"use client";

// Company setup: 4 steps (Basic · Contact & address · Legal & billing ·
// Workplace), full width on a light page. Each step is checked before moving
// on; the draft is kept in this browser so a refresh doesn't lose it.
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Building2, Check, FileText, MapPin, Settings2 } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { ImageUpload } from "@/components/common/image-upload";
import { FormSelect } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ATTENDANCE_MODES,
  BUSINESS_TYPES,
  CURRENCIES,
  EMPLOYEE_RANGES,
  INDIAN_STATES,
  INDUSTRIES,
  LEAVE_YEARS,
  MONTHS,
  PAN_REQUIRED,
  TIMES,
  TIMEZONES,
  WEEK_DAYS,
  gstState,
} from "@/lib/company-rules";
import { CODE_DIGITS, CODE_FORMATS, previewCode } from "@/lib/employee-code";
import { COMPANY_STEPS, EMPTY_COMPANY, companySchema, type CompanyForm, type CompanyInput } from "@/lib/schemas/company";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const STEP_ICONS = [Building2, MapPin, FileText, Settings2];
const ON = "data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary";

// Draft kept per user in this browser (never shared; cleared once the company is created)
const draftKey = (userId: number) => `workkind-company-setup:${userId}`;
function readDraft(userId: number): Partial<CompanyForm> | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? (JSON.parse(raw) as Partial<CompanyForm>) : null;
  } catch {
    return null;
  }
}

export function CompanyWizard({ userId, defaultName = "", submitLabel, onCreated }: { userId: number; defaultName?: string; submitLabel: string; onCreated: () => void }) {
  const createCompany = useAuthStore((s) => s.createCompany);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [logoUploading, setLogoUploading] = useState(false);
  const [initial] = useState<CompanyForm>(() => ({ ...EMPTY_COMPANY, companyName: defaultName, ...readDraft(userId) }));
  const {
    register,
    handleSubmit,
    control,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompanyForm, unknown, CompanyInput>({ resolver: zodResolver(companySchema), defaultValues: initial, mode: "onTouched" });

  const values = useWatch({ control });
  const country = values.country ?? "";
  const india = country.trim().toLowerCase() === "india";
  const panRequired = india && PAN_REQUIRED.includes(values.businessType ?? "");
  const gstStateName = gstState((values.gstin ?? "").toUpperCase());

  // Save the draft as they type
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(userId), JSON.stringify(values));
      } catch {
        // storage blocked — the form still works, just without a saved draft
      }
    }, 400);
    return () => clearTimeout(t);
  }, [values, userId]);

  async function next() {
    const ok = await trigger(COMPANY_STEPS[step].fields as unknown as (keyof CompanyForm)[]);
    if (!ok) return;
    setDone((d) => new Set(d).add(step));
    setStep((s) => Math.min(s + 1, COMPANY_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(input: CompanyInput) {
    if (await createCompany(input)) {
      try {
        localStorage.removeItem(draftKey(userId));
      } catch {
        // nothing to clean up
      }
      onCreated();
    }
  }

  // A problem in an earlier step (e.g. edited after moving on) → go back to it
  function onInvalid(errs: Record<string, unknown>) {
    const first = COMPANY_STEPS.findIndex((s) => s.fields.some((f) => f in errs));
    if (first >= 0) setStep(first);
  }

  const last = step === COMPANY_STEPS.length - 1;
  const current = COMPANY_STEPS[step];
  const Icon = STEP_ICONS[step];

  return (
    <div className="flex flex-col gap-6">
      {/* Steps */}
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {COMPANY_STEPS.map((s, i) => {
          const StepIcon = STEP_ICONS[i];
          const active = i === step;
          const complete = done.has(i) && !active;
          const reachable = i < step || done.has(i) || done.has(i - 1);
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors disabled:cursor-not-allowed",
                  active ? "border-primary shadow-sm ring-2 ring-primary/15" : "border-slate-200 hover:border-slate-300",
                  !reachable && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    complete ? "bg-emerald-50 text-emerald-600" : active ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {complete ? <Check className="size-4" /> : <StepIcon className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-2xs font-semibold tracking-wider text-slate-400 uppercase">Step {i + 1}</span>
                  <span className={cn("block truncate text-sm font-semibold", active ? "text-slate-900" : "text-slate-600")}>{s.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate autoComplete="off" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-8">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{current.title}</h2>
            <p className="text-xs text-slate-500">Fields marked * are required.</p>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-8">
          {step === 0 && (
            <FormGrid>
              <FormField label="Company logo" htmlFor="co-logo" span="full" float={false}>
                <Controller
                  control={control}
                  name="logoUrl"
                  render={({ field }) => (
                    <ImageUpload
                      id="co-logo"
                      kind="company-logo"
                      label="Upload company logo"
                      hint="Optional. Square PNG or SVG works best, up to 5 MB."
                      value={field.value}
                      onChange={field.onChange}
                      onUploadingChange={setLogoUploading}
                    />
                  )}
                />
              </FormField>
              <FormField label="Company / brand name" htmlFor="co-name" error={errors.companyName} required span="md">
                <Input id="co-name" autoFocus placeholder="e.g. Acme" aria-invalid={Boolean(errors.companyName)} {...register("companyName")} />
              </FormField>
              <FormField label="Legal business name" htmlFor="co-legal" error={errors.legalName} span="md">
                <Input id="co-legal" placeholder="e.g. Acme Technologies Private Limited" {...register("legalName")} />
              </FormField>
              <FormField label="Industry" htmlFor="co-industry" error={errors.industry} required>
                <Input id="co-industry" list="co-industries" placeholder="Pick or type" aria-invalid={Boolean(errors.industry)} {...register("industry")} />
                <datalist id="co-industries">
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </FormField>
              <FormField label="Business type" htmlFor="co-type" error={errors.businessType} required>
                <FormSelect control={control} name="businessType" id="co-type" options={BUSINESS_TYPES.map((b) => ({ value: b.value, label: b.label }))} />
              </FormField>
              <FormField label="Company website" htmlFor="co-website" error={errors.website}>
                <Input id="co-website" inputMode="url" placeholder="example.com" aria-invalid={Boolean(errors.website)} {...register("website")} />
              </FormField>
              <FormField label="Year established" htmlFor="co-year" error={errors.yearEstablished}>
                <Input id="co-year" inputMode="numeric" maxLength={4} placeholder="e.g. 2015" aria-invalid={Boolean(errors.yearEstablished)} {...register("yearEstablished")} />
              </FormField>
              <FormField label="Employee count" htmlFor="co-size" error={errors.employeeRange} required span="full" float={false}>
                <Controller
                  control={control}
                  name="employeeRange"
                  render={({ field }) => (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      aria-label="Employee count"
                      className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
                    >
                      {EMPLOYEE_RANGES.map((r) => (
                        <ToggleGroupItem key={r.value} value={r.value} className={cn("h-auto w-full flex-col gap-0 py-2.5 font-medium", ON)}>
                          {r.label}
                          <span className="text-2xs font-normal text-muted-foreground">employees</span>
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                />
              </FormField>
            </FormGrid>
          )}

          {step === 1 && (
            <FormGrid>
              <FormField label="Official email" htmlFor="co-email" error={errors.email} required>
                <Input id="co-email" type="email" placeholder="hr@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
              </FormField>
              <FormField label="Contact phone" htmlFor="co-phone" error={errors.phone} required>
                <Input id="co-phone" type="tel" placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
              </FormField>
              <FormField label="Country" htmlFor="co-country" error={errors.country} required>
                <Input id="co-country" aria-invalid={Boolean(errors.country)} {...register("country")} />
              </FormField>
              <FormField label="State" htmlFor="co-state" error={errors.state} required>
                <Input id="co-state" list={india ? "co-states" : undefined} aria-invalid={Boolean(errors.state)} {...register("state")} />
                <datalist id="co-states">
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </FormField>
              <FormField label="City" htmlFor="co-city" error={errors.city} required>
                <Input id="co-city" aria-invalid={Boolean(errors.city)} {...register("city")} />
              </FormField>
              <FormField label="Postal code" htmlFor="co-postal" error={errors.postalCode} required>
                <Input id="co-postal" inputMode="numeric" aria-invalid={Boolean(errors.postalCode)} {...register("postalCode")} />
              </FormField>
              <FormField label="Registered address" htmlFor="co-address" error={errors.address} required span="lg">
                <Textarea id="co-address" rows={2} placeholder="Building, street, area" aria-invalid={Boolean(errors.address)} {...register("address")} />
              </FormField>
              <FormField label="Company timezone" htmlFor="co-tz" error={errors.timezone} required>
                <FormSelect control={control} name="timezone" id="co-tz" options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))} />
              </FormField>
              <FormField label="Other office locations" htmlFor="co-offices" error={errors.officeLocations} span="lg">
                <Textarea id="co-offices" rows={2} placeholder="Optional — e.g. Noida, Gurgaon, Bangalore (one per line)" {...register("officeLocations")} />
              </FormField>
            </FormGrid>
          )}

          {step === 2 && (
            <FormGrid>
              <FormField label="Company PAN" htmlFor="co-pan" error={errors.pan} required={panRequired} description={panRequired ? undefined : "Optional for this business type"}>
                <Input id="co-pan" maxLength={10} placeholder="ABCDE1234F" className="uppercase" aria-invalid={Boolean(errors.pan)} {...register("pan")} />
              </FormField>
              <FormField label="GSTIN" htmlFor="co-gstin" error={errors.gstin} description="If registered for GST">
                <Input id="co-gstin" maxLength={15} placeholder="22ABCDE1234F1Z5" className="uppercase" aria-invalid={Boolean(errors.gstin)} {...register("gstin")} />
              </FormField>
              <FormField label="GST registration state" htmlFor="co-gst-state" description="From the GSTIN">
                <Input id="co-gst-state" value={gstStateName ?? ""} readOnly disabled placeholder="—" />
              </FormField>
              <FormField label="CIN / LLPIN" htmlFor="co-cin" error={errors.cinLlpin} description="If incorporated">
                <Input id="co-cin" maxLength={21} placeholder="U72900KA2020PTC123456" className="uppercase" aria-invalid={Boolean(errors.cinLlpin)} {...register("cinLlpin")} />
              </FormField>
              <FormField label="TAN" htmlFor="co-tan" error={errors.tan} description="For payroll TDS">
                <Input id="co-tan" maxLength={10} placeholder="ABCD12345E" className="uppercase" aria-invalid={Boolean(errors.tan)} {...register("tan")} />
              </FormField>
              <div className="col-span-12">
                <Controller
                  control={control}
                  name="billingSame"
                  render={({ field }) => (
                    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                      Billing address is the same as the registered address
                    </label>
                  )}
                />
              </div>
              {!values.billingSame && (
                <FormField label="Billing address" htmlFor="co-billing" error={errors.billingAddress} required span="lg">
                  <Textarea id="co-billing" rows={2} aria-invalid={Boolean(errors.billingAddress)} {...register("billingAddress")} />
                </FormField>
              )}
              <p className="col-span-12 text-xs text-slate-500">
                IDs are checked for the right format now; the Workkind team verifies them later. Supporting documents can be uploaded after setup.
              </p>
            </FormGrid>
          )}

          {step === 3 && (
            <FormGrid>
              <FormField label="Default work week" htmlFor="co-days" error={errors.workDays as { message?: string } | undefined} required span="full" float={false}>
                <div className="flex flex-wrap items-center gap-3">
                  <Controller
                    control={control}
                    name="workDays"
                    render={({ field }) => (
                      <ToggleGroup type="multiple" variant="outline" value={field.value} onValueChange={field.onChange} aria-label="Working days" className="flex-wrap">
                        {WEEK_DAYS.map((d) => (
                          <ToggleGroupItem key={d.value} value={d.value} className={cn("w-14", ON)}>
                            {d.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                  <div className="flex gap-2 text-xs">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setValue("workDays", ["mon", "tue", "wed", "thu", "fri"], { shouldValidate: true })}>
                      Mon – Fri
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setValue("workDays", ["mon", "tue", "wed", "thu", "fri", "sat"], { shouldValidate: true })}>
                      Mon – Sat
                    </Button>
                  </div>
                </div>
              </FormField>
              <FormField label="Office start time" htmlFor="co-start" error={errors.officeStart} required>
                <FormSelect control={control} name="officeStart" id="co-start" options={TIMES.map((t) => ({ value: t.value, label: t.label }))} />
              </FormField>
              <FormField label="Office end time" htmlFor="co-end" error={errors.officeEnd} required>
                <FormSelect control={control} name="officeEnd" id="co-end" options={TIMES.map((t) => ({ value: t.value, label: t.label }))} />
              </FormField>
              <FormField label="Attendance mode" htmlFor="co-mode" error={errors.attendanceMode} required>
                <FormSelect control={control} name="attendanceMode" id="co-mode" options={ATTENDANCE_MODES.map((m) => ({ value: m.value, label: m.label }))} />
              </FormField>
              <FormField label="Leave year" htmlFor="co-leave-year" error={errors.leaveYear} required>
                <FormSelect control={control} name="leaveYear" id="co-leave-year" options={LEAVE_YEARS.map((m) => ({ value: m.value, label: m.label }))} />
              </FormField>
              <FormField label="Fiscal year starts" htmlFor="co-fiscal" error={errors.fiscalYearStart}>
                <FormSelect control={control} name="fiscalYearStart" id="co-fiscal" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
              </FormField>
              <FormField label="Default currency" htmlFor="co-currency" error={errors.currency} required>
                <FormSelect control={control} name="currency" id="co-currency" options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))} />
              </FormField>
              <FormField label="Employee ID prefix" htmlFor="co-prefix" error={errors.employeeIdPrefix} description="Optional, e.g. ACME- → ACME-001">
                <Input id="co-prefix" maxLength={10} placeholder="ACME-" className="uppercase" aria-invalid={Boolean(errors.employeeIdPrefix)} {...register("employeeIdPrefix")} />
              </FormField>
              <FormField label="Employee code format" htmlFor="co-code-format" error={errors.employeeCodeFormat} span="md">
                <FormSelect
                  control={control}
                  name="employeeCodeFormat"
                  id="co-code-format"
                  options={CODE_FORMATS.map((f) => ({ value: f.value, label: `${f.label} — ${previewCode(values.employeeIdPrefix || "EMP", f.value, Number(values.employeeCodeDigits) || 3)}` }))}
                />
              </FormField>
              <FormField label="Number digits" htmlFor="co-code-digits" error={errors.employeeCodeDigits}>
                <FormSelect control={control} name="employeeCodeDigits" id="co-code-digits" options={CODE_DIGITS.map((d) => ({ value: d, label: `${d} digits` }))} />
              </FormField>
            </FormGrid>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-slate-500">
            Step {step + 1} of {COMPANY_STEPS.length} · Your answers are saved in this browser as you go.
          </p>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft /> Previous
              </Button>
            )}
            {/* Separate keys: reusing one <button> for Next → Create would let the
                Next click also submit the form when the last step appears */}
            {last ? (
              <Button key="submit" type="submit" size="lg" disabled={isSubmitting || logoUploading}>
                {isSubmitting ? <Spinner /> : <Check />} {isSubmitting ? "Creating…" : submitLabel}
              </Button>
            ) : (
              <Button key="next" type="button" size="lg" onClick={next} disabled={logoUploading}>
                Next <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
