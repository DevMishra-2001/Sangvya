"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { ImageUpload } from "@/components/common/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import {
  EMPLOYEE_RANGES,
  INDUSTRIES,
  OTHER_DESIGNATION,
  companySchema,
  type CompanyForm as CompanyFormValues,
  type CompanyInput,
} from "@/lib/schemas/company";
import { designationsService } from "@/lib/services/designations";
import { useAuthStore } from "@/stores/auth-store";
import { FormSelect } from "@/components/common/select-field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 md:grid-cols-[13rem_1fr] md:gap-8">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

// Everything about a new company. Creating it seeds the default designations
// and adds the owner as the company's first employee.
export function CompanyForm({ submitLabel, onCreated }: { submitLabel: string; onCreated: () => void }) {
  const createCompany = useAuthStore((s) => s.createCompany);
  const [presets, setPresets] = useState<string[]>([]);
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
      designation: "Founder",
      customDesignation: "",
    },
  });
  const designation = useWatch({ control, name: "designation" });

  useEffect(() => {
    run(designationsService.defaults, { silent: true }).then((r) => r.ok && setPresets(r.data));
  }, []);

  async function onSubmit(values: CompanyInput) {
    if (await createCompany(values)) onCreated();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Section title="Company" description="Shown in the sidebar and on payslips.">
        <FormField label="Logo" htmlFor="co-logo" className="sm:col-span-2">
          <Controller
            control={control}
            name="logoUrl"
            render={({ field }) => (
              <ImageUpload
                id="co-logo"
                kind="company-logo"
                label="Upload company logo"
                hint="Square PNG or SVG works best, up to 5 MB."
                value={field.value}
                onChange={field.onChange}
                onUploadingChange={setLogoUploading}
              />
            )}
          />
        </FormField>
        <FormField label="Company name" htmlFor="co-name" error={errors.companyName} className="sm:col-span-2">
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
      </Section>

      <Separator />

      <Section title="Company size" description="How many people work here, roughly.">
        <Controller
          control={control}
          name="employeeRange"
          render={({ field }) => (
            <div className="sm:col-span-2">
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
                aria-label="Company size"
                aria-invalid={Boolean(errors.employeeRange) || undefined}
                className="grid w-full grid-cols-2 sm:grid-cols-3"
              >
                {EMPLOYEE_RANGES.map((r) => (
                  <ToggleGroupItem key={r.value} value={r.value} className="h-auto w-full flex-col gap-0 py-2.5 font-medium data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                    {r.label}
                    <span className="text-2xs font-normal text-muted-foreground">employees</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {errors.employeeRange && <p className="mt-1.5 text-sm text-destructive">{errors.employeeRange.message}</p>}
            </div>
          )}
        />
      </Section>

      <Separator />

      <Section title="Contact" description="Optional. Used on documents like payslips.">
        <FormField label="Company email" htmlFor="co-email" error={errors.email}>
          <Input id="co-email" type="email" placeholder="hr@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="co-phone" error={errors.phone}>
          <Input id="co-phone" type="tel" placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
        </FormField>
        <FormField label="Address" htmlFor="co-address" error={errors.address} className="sm:col-span-2">
          <Textarea id="co-address" rows={2} placeholder="Building, street, area" {...register("address")} />
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
      </Section>

      <Separator />

      <Section title="About you" description="You're added as the company's first employee.">
        <FormField label="Your designation" htmlFor="co-designation" error={errors.designation}>
          <FormSelect
            control={control}
            name="designation"
            id="co-designation"
            options={[...(presets.length ? presets : ["Founder"]).map((p) => ({ value: p, label: p })), { value: OTHER_DESIGNATION, label: "Other…" }]}
          />
        </FormField>
        {designation === OTHER_DESIGNATION && (
          <FormField label="Designation" htmlFor="co-custom" error={errors.customDesignation}>
            <Input id="co-custom" placeholder="e.g. Managing Partner" aria-invalid={Boolean(errors.customDesignation)} {...register("customDesignation")} />
          </FormField>
        )}
      </Section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting || logoUploading} className="w-full sm:w-auto">
          {isSubmitting && <Spinner />} {isSubmitting ? "Creating…" : logoUploading ? "Uploading logo…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
