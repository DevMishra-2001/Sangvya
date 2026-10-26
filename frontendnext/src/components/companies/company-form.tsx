"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { FieldSeparator, FormActions, FormGrid } from "@/components/common/form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  EMPLOYEE_RANGES,
  INDUSTRIES,
  companySchema,
  type CompanyForm as CompanyFormValues,
  type CompanyInput,
} from "@/lib/schemas/company";
import { useAuthStore } from "@/stores/auth-store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Everything about a new company. Creating it adds the owner as its first
// employee, with the Admin designation.
export function CompanyForm({ submitLabel, onCreated }: { submitLabel: string; onCreated: () => void }) {
  const createCompany = useAuthStore((s) => s.createCompany);
  const [logoUploading, setLogoUploading] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues, unknown, CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      logoUrl: null,
      companyName: "",
      industry: "",
      employeeRange: "",
      website: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "India",
      postalCode: "",
    },
  });
  async function onSubmit(values: CompanyInput) {
    if (await createCompany(values)) onCreated();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
      <FormGrid density="dialog">
        <FieldSeparator label="Company" />
        <FormField label="Logo" htmlFor="co-logo" span="full" float={false}>
          <Controller
            control={control}
            name="logoUrl"
            render={({ field }) => (
              <ImageUpload
                id="co-logo"
                kind="company-logo"
                label="Upload company logo"
                hint="Square PNG or SVG works best, up to 5 MB. Shown in the sidebar."
                value={field.value}
                onChange={field.onChange}
                onUploadingChange={setLogoUploading}
              />
            )}
          />
        </FormField>
        <FormField label="Company name" htmlFor="co-name" error={errors.companyName} required>
          <Input id="co-name" autoFocus placeholder="e.g. Acme Technologies Pvt Ltd" aria-invalid={Boolean(errors.companyName)} {...register("companyName")} />
        </FormField>
        <FormField label="Industry" htmlFor="co-industry" error={errors.industry}>
          <Input id="co-industry" list="co-industries" placeholder="Pick or type" {...register("industry")} />
          <datalist id="co-industries">
            {INDUSTRIES.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Website" htmlFor="co-website" error={errors.website}>
          <Input id="co-website" inputMode="url" placeholder="example.com" aria-invalid={Boolean(errors.website)} {...register("website")} />
        </FormField>

        <FieldSeparator label="Company size" />
        <Controller
          control={control}
          name="employeeRange"
          render={({ field }) => (
            <div className="col-span-12">
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
                aria-label="Company size"
                aria-invalid={Boolean(errors.employeeRange) || undefined}
                className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
              >
                {EMPLOYEE_RANGES.map((r) => (
                  <ToggleGroupItem
                    key={r.value}
                    value={r.value}
                    className="h-auto w-full flex-col gap-0 py-2.5 font-medium data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                  >
                    {r.label}
                    <span className="text-2xs font-normal text-muted-foreground">employees</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {errors.employeeRange && <p className="mt-1.5 text-sm text-destructive">{errors.employeeRange.message}</p>}
            </div>
          )}
        />

        <FieldSeparator label="Contact & address" />
        <FormField label="Company email" htmlFor="co-email" error={errors.email}>
          <Input id="co-email" type="email" placeholder="hr@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="co-phone" error={errors.phone}>
          <Input id="co-phone" type="tel" placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
        </FormField>
        <FormField label="Address" htmlFor="co-address" error={errors.address}>
          <Input id="co-address" placeholder="Building, street, area" {...register("address")} />
        </FormField>
        <FormField label="City" htmlFor="co-city" error={errors.city}>
          <Input id="co-city" {...register("city")} />
        </FormField>
        <FormField label="State" htmlFor="co-state" error={errors.state}>
          <Input id="co-state" {...register("state")} />
        </FormField>
        <FormField label="Country" htmlFor="co-country" error={errors.country}>
          <Input id="co-country" {...register("country")} />
        </FormField>
        <FormField label="PIN / ZIP code" htmlFor="co-postal" error={errors.postalCode}>
          <Input id="co-postal" inputMode="numeric" {...register("postalCode")} />
        </FormField>
        <FormActions>
          <Button type="submit" disabled={isSubmitting || logoUploading} className="w-full sm:w-auto">
            {isSubmitting && <Spinner />} {isSubmitting ? "Creating…" : logoUploading ? "Uploading logo…" : submitLabel}
          </Button>
        </FormActions>
      </FormGrid>
    </form>
  );
}
