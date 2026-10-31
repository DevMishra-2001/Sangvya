"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Save } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormActions, FormCard, FormGrid } from "@/components/common/form-layout";
import { ImageUpload } from "@/components/common/image-upload";
import { FormMultiSelect } from "@/components/common/multi-select";
import { FormSelect } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
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
import { EMPTY_COMPANY, companySchema, type CompanyForm, type CompanyInput } from "@/lib/schemas/company";
import { companiesService } from "@/lib/services/companies";
import type { Company } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));

function toForm(c: Company): CompanyForm {
  return {
    ...EMPTY_COMPANY,
    logoUrl: c.logo_url,
    companyName: c.name,
    legalName: s(c.legal_name),
    industry: s(c.industry),
    businessType: s(c.business_type),
    employeeRange: s(c.employee_range),
    website: s(c.website),
    yearEstablished: s(c.year_established),
    email: s(c.email),
    phone: s(c.phone),
    country: s(c.country) || "India",
    state: s(c.state),
    city: s(c.city),
    address: s(c.address),
    postalCode: s(c.postal_code),
    officeLocations: s(c.office_locations),
    timezone: s(c.timezone) || "Asia/Kolkata",
    pan: s(c.pan),
    gstin: s(c.gstin),
    cinLlpin: s(c.cin_llpin),
    tan: s(c.tan),
    billingSame: !c.billing_address || c.billing_address === c.address,
    billingAddress: s(c.billing_address),
    workDays: c.work_days ? c.work_days.split(",") : EMPTY_COMPANY.workDays,
    officeStart: s(c.office_start) || "09:30",
    officeEnd: s(c.office_end) || "18:30",
    attendanceMode: s(c.attendance_mode) || "office",
    leaveYear: s(c.leave_year) || "financial",
    fiscalYearStart: s(c.fiscal_year_start) || "4",
    currency: s(c.currency) || "INR",
    employeeIdPrefix: s(c.employee_id_prefix),
    employeeCodeFormat: c.employee_code_format ?? "prefix_seq",
    employeeCodeDigits: String(c.employee_code_digits ?? 3),
  };
}

// The details given at company setup, editable by the Admin
export function CompanyDetailsForm({ company, onSaved }: { company: Company; onSaved: (c: Company) => void }) {
  const loadMe = useAuthStore((st) => st.loadMe);
  const [logoUploading, setLogoUploading] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanyForm, unknown, CompanyInput>({ resolver: zodResolver(companySchema), defaultValues: toForm(company) });

  useEffect(() => reset(toForm(company)), [company, reset]);

  const [country, businessType, gstin, billingSame, prefix, codeFormat, codeDigits] = useWatch({
    control,
    name: ["country", "businessType", "gstin", "billingSame", "employeeIdPrefix", "employeeCodeFormat", "employeeCodeDigits"],
  });
  const codePrefix = prefix || company.name.slice(0, 3).toUpperCase();
  const india = (country ?? "").trim().toLowerCase() === "india";
  const panRequired = india && PAN_REQUIRED.includes(businessType ?? "");

  async function onSubmit(input: CompanyInput) {
    const r = await run(() => companiesService.update(input), { success: "Company details saved" });
    if (!r.ok) return;
    onSaved(r.data);
    loadMe(); // name / logo in the header
  }

  return (
    <FormCard title="Company details" crumbs={["Company"]} icon={Building2}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
        <FormGrid>
          <FormField label="Logo" htmlFor="cs-logo" span="full" float={false}>
            <Controller
              control={control}
              name="logoUrl"
              render={({ field }) => (
                <ImageUpload id="cs-logo" kind="company-logo" label="Upload company logo" hint="Square PNG or SVG works best, up to 5 MB." value={field.value} onChange={field.onChange} onUploadingChange={setLogoUploading} />
              )}
            />
          </FormField>

          <FieldSeparator label="Basic" />
          <FormField label="Company / brand name" htmlFor="cs-name" error={errors.companyName} required>
            <Input id="cs-name" aria-invalid={Boolean(errors.companyName)} {...register("companyName")} />
          </FormField>
          <FormField label="Legal business name" htmlFor="cs-legal" error={errors.legalName}>
            <Input id="cs-legal" {...register("legalName")} />
          </FormField>
          <FormField label="Industry" htmlFor="cs-industry" error={errors.industry} required>
            <Input id="cs-industry" list="cs-industries" aria-invalid={Boolean(errors.industry)} {...register("industry")} />
            <datalist id="cs-industries">
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </FormField>
          <FormField label="Business type" htmlFor="cs-type" error={errors.businessType} required>
            <FormSelect control={control} name="businessType" id="cs-type" options={BUSINESS_TYPES.map((b) => ({ value: b.value, label: b.label }))} />
          </FormField>
          <FormField label="Employee count" htmlFor="cs-size" error={errors.employeeRange} required>
            <FormSelect control={control} name="employeeRange" id="cs-size" options={EMPLOYEE_RANGES.map((r) => ({ value: r.value, label: `${r.label} employees` }))} />
          </FormField>
          <FormField label="Website" htmlFor="cs-website" error={errors.website}>
            <Input id="cs-website" inputMode="url" placeholder="example.com" {...register("website")} />
          </FormField>
          <FormField label="Year established" htmlFor="cs-year" error={errors.yearEstablished}>
            <Input id="cs-year" inputMode="numeric" maxLength={4} {...register("yearEstablished")} />
          </FormField>

          <FieldSeparator label="Contact & address" />
          <FormField label="Official email" htmlFor="cs-email" error={errors.email} required>
            <Input id="cs-email" type="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
          </FormField>
          <FormField label="Contact phone" htmlFor="cs-phone" error={errors.phone} required>
            <Input id="cs-phone" type="tel" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
          </FormField>
          <FormField label="Country" htmlFor="cs-country" error={errors.country} required>
            <Input id="cs-country" {...register("country")} />
          </FormField>
          <FormField label="State" htmlFor="cs-state" error={errors.state} required>
            <Input id="cs-state" list={india ? "cs-states" : undefined} {...register("state")} />
            <datalist id="cs-states">
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st} />
              ))}
            </datalist>
          </FormField>
          <FormField label="City" htmlFor="cs-city" error={errors.city} required>
            <Input id="cs-city" {...register("city")} />
          </FormField>
          <FormField label="Postal code" htmlFor="cs-postal" error={errors.postalCode} required>
            <Input id="cs-postal" inputMode="numeric" {...register("postalCode")} />
          </FormField>
          <FormField label="Registered address" htmlFor="cs-address" error={errors.address} required span="lg">
            <Textarea id="cs-address" rows={2} {...register("address")} />
          </FormField>
          <FormField label="Timezone" htmlFor="cs-tz" error={errors.timezone} required>
            <FormSelect control={control} name="timezone" id="cs-tz" options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))} />
          </FormField>

          <FieldSeparator label="Legal & billing" />
          <FormField label="Company PAN" htmlFor="cs-pan" error={errors.pan} required={panRequired}>
            <Input id="cs-pan" maxLength={10} className="uppercase" {...register("pan")} />
          </FormField>
          <FormField label="GSTIN" htmlFor="cs-gstin" error={errors.gstin} description={gstState((gstin ?? "").toUpperCase()) ?? undefined}>
            <Input id="cs-gstin" maxLength={15} className="uppercase" {...register("gstin")} />
          </FormField>
          <FormField label="CIN / LLPIN" htmlFor="cs-cin" error={errors.cinLlpin}>
            <Input id="cs-cin" maxLength={21} className="uppercase" {...register("cinLlpin")} />
          </FormField>
          <FormField label="TAN" htmlFor="cs-tan" error={errors.tan}>
            <Input id="cs-tan" maxLength={10} className="uppercase" {...register("tan")} />
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
          {!billingSame && (
            <FormField label="Billing address" htmlFor="cs-billing" error={errors.billingAddress} required span="lg">
              <Textarea id="cs-billing" rows={2} {...register("billingAddress")} />
            </FormField>
          )}

          <FieldSeparator label="Workplace" />
          <FormField label="Working days" htmlFor="cs-days" error={errors.workDays as { message?: string } | undefined} required span="md">
            <FormMultiSelect control={control} name="workDays" id="cs-days" options={WEEK_DAYS.map((d) => ({ value: d.value, label: d.label }))} />
          </FormField>
          <FormField label="Office start" htmlFor="cs-start" error={errors.officeStart} required>
            <FormSelect control={control} name="officeStart" id="cs-start" options={TIMES.map((t) => ({ value: t.value, label: t.label }))} />
          </FormField>
          <FormField label="Office end" htmlFor="cs-end" error={errors.officeEnd} required>
            <FormSelect control={control} name="officeEnd" id="cs-end" options={TIMES.map((t) => ({ value: t.value, label: t.label }))} />
          </FormField>
          <FormField label="Attendance mode" htmlFor="cs-mode" error={errors.attendanceMode} required>
            <FormSelect control={control} name="attendanceMode" id="cs-mode" options={ATTENDANCE_MODES.map((m) => ({ value: m.value, label: m.label }))} />
          </FormField>
          <FormField label="Leave year" htmlFor="cs-leave" error={errors.leaveYear} required>
            <FormSelect control={control} name="leaveYear" id="cs-leave" options={LEAVE_YEARS.map((m) => ({ value: m.value, label: m.label }))} />
          </FormField>
          <FormField label="Fiscal year starts" htmlFor="cs-fiscal" error={errors.fiscalYearStart}>
            <FormSelect control={control} name="fiscalYearStart" id="cs-fiscal" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          </FormField>
          <FormField label="Currency" htmlFor="cs-currency" error={errors.currency} required>
            <FormSelect control={control} name="currency" id="cs-currency" options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))} />
          </FormField>

          <FieldSeparator label="Employee codes" />
          <FormField label="Employee ID prefix" htmlFor="cs-prefix" error={errors.employeeIdPrefix} description="e.g. ISP, ACME">
            <Input id="cs-prefix" maxLength={10} className="uppercase" {...register("employeeIdPrefix")} />
          </FormField>
          <FormField label="Code format" htmlFor="cs-code-format" error={errors.employeeCodeFormat} span="md">
            <FormSelect
              control={control}
              name="employeeCodeFormat"
              id="cs-code-format"
              options={CODE_FORMATS.map((f) => ({ value: f.value, label: `${f.label} — ${previewCode(codePrefix, f.value, Number(codeDigits) || 3)}` }))}
            />
          </FormField>
          <FormField label="Number digits" htmlFor="cs-code-digits" error={errors.employeeCodeDigits}>
            <FormSelect control={control} name="employeeCodeDigits" id="cs-code-digits" options={CODE_DIGITS.map((d) => ({ value: d, label: `${d} digits` }))} />
          </FormField>
          <p className="col-span-12 -mt-2 text-xs text-muted-foreground">
            New employees get the next code automatically, e.g. <strong className="font-mono text-foreground">{previewCode(codePrefix, codeFormat ?? "prefix_seq", Number(codeDigits) || 3)}</strong>. Year formats start again at 1 each year. HR can still change it.
          </p>

          <FormActions span="full">
            <Button type="submit" disabled={isSubmitting || logoUploading || !isDirty}>
              {isSubmitting ? <Spinner /> : <Save />} Save changes
            </Button>
          </FormActions>
        </FormGrid>
      </form>
    </FormCard>
  );
}
