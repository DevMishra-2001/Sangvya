"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, Save, Settings } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormActions, FormCard, FormGrid } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { FormSelect } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { reportsService, type ReportSettings } from "@/lib/services/reports";

const yesNo = z.enum(["yes", "no"]);
const schema = z
  .object({
    letterhead: yesNo,
    showLogo: yesNo,
    showAddress: yesNo,
    showContact: yesNo,
    showTaxIds: yesNo,
    showGenerated: yesNo,
    watermarkKind: z.enum(["none", "CONFIDENTIAL", "DRAFT", "custom"]),
    watermarkText: z.string().trim().max(40, "At most 40 characters"),
    footerText: z.string().trim().max(200, "At most 200 characters"),
    signatureLabel: z.string().trim().max(60, "At most 60 characters"),
  })
  .refine((v) => v.watermarkKind !== "custom" || v.watermarkText, { path: ["watermarkText"], message: "Type the watermark text" });
type Form = z.input<typeof schema>;

const SHOW = [
  { value: "yes", label: "Show" },
  { value: "no", label: "Hide" },
];
const yn = (b: boolean) => (b ? "yes" : "no");
const toForm = (s: ReportSettings): Form => ({
  letterhead: yn(s.letterhead),
  showLogo: yn(s.showLogo),
  showAddress: yn(s.showAddress),
  showContact: yn(s.showContact),
  showTaxIds: yn(s.showTaxIds),
  showGenerated: yn(s.showGenerated),
  watermarkKind: !s.watermark ? "none" : s.watermark === "CONFIDENTIAL" || s.watermark === "DRAFT" ? s.watermark : "custom",
  watermarkText: s.watermark && s.watermark !== "CONFIDENTIAL" && s.watermark !== "DRAFT" ? s.watermark : "",
  footerText: s.footerText ?? "",
  signatureLabel: s.signatureLabel ?? "",
});
const fromForm = (f: Form): ReportSettings => ({
  letterhead: f.letterhead === "yes",
  showLogo: f.showLogo === "yes",
  showAddress: f.showAddress === "yes",
  showContact: f.showContact === "yes",
  showTaxIds: f.showTaxIds === "yes",
  showGenerated: f.showGenerated === "yes",
  watermark: f.watermarkKind === "none" ? null : f.watermarkKind === "custom" ? f.watermarkText.trim() : f.watermarkKind,
  footerText: f.footerText.trim() || null,
  signatureLabel: f.signatureLabel.trim() || null,
});

// Admin: how every PDF (reports, payslips) looks — letterhead, footer, watermark, signature
export function ReportSettingsView() {
  const [loaded, setLoaded] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Form>({ resolver: zodResolver(schema) });
  const letterhead = useWatch({ control, name: "letterhead" });
  const watermarkKind = useWatch({ control, name: "watermarkKind" });

  useEffect(() => {
    run(reportsService.settings).then((r) => {
      if (r.ok) reset(toForm(r.data));
      setLoaded(true);
    });
  }, [reset]);

  async function save(values: Form) {
    const r = await run(() => reportsService.saveSettings(fromForm(values)), { success: "Report settings saved" });
    if (r.ok) reset(toForm(r.data));
    return r.ok;
  }

  // Unsaved changes are saved first, so the preview shows them
  async function preview() {
    if (isDirty) {
      let ok = false;
      await handleSubmit(async (v) => {
        ok = await save(v);
      })();
      if (!ok) return;
    }
    setPreviewing(true);
    await run(reportsService.preview, { error: "Couldn't create the preview" });
    setPreviewing(false);
  }

  if (!loaded) return <Skeleton className="h-96 w-full rounded-xl" />;
  const off = letterhead === "no";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Report settings" description="How every PDF looks — reports and payslips. The letterhead uses your company's details and logo." className="mb-0" />
      <FormCard title="PDF layout" crumbs={["Reports", "Settings"]} icon={Settings}>
        <form onSubmit={handleSubmit(save)} noValidate autoComplete="off">
          <FormGrid>
            <FormField label="Letterhead" htmlFor="rs-letterhead">
              <FormSelect control={control} name="letterhead" id="rs-letterhead" options={SHOW} />
            </FormField>
            <FormField label="Company logo" htmlFor="rs-logo">
              <FormSelect control={control} name="showLogo" id="rs-logo" options={SHOW} disabled={off} />
            </FormField>
            <FormField label="Address" htmlFor="rs-address">
              <FormSelect control={control} name="showAddress" id="rs-address" options={SHOW} disabled={off} />
            </FormField>
            <FormField label="Email / phone / website" htmlFor="rs-contact">
              <FormSelect control={control} name="showContact" id="rs-contact" options={SHOW} disabled={off} />
            </FormField>
            <FormField label="GSTIN / PAN" htmlFor="rs-tax">
              <FormSelect control={control} name="showTaxIds" id="rs-tax" options={SHOW} disabled={off} />
            </FormField>

            <FieldSeparator label="Footer & extras" />

            <FormField label="Footer text" htmlFor="rs-footer" error={errors.footerText} span="md" description="Left of every page's footer (default: company name)">
              <Input id="rs-footer" maxLength={200} placeholder="e.g. Confidential — for internal use only" {...register("footerText")} />
            </FormField>
            <FormField label="Printed by / printed at" htmlFor="rs-printed">
              <FormSelect control={control} name="showGenerated" id="rs-printed" options={SHOW} />
            </FormField>
            <FormField label="Watermark" htmlFor="rs-watermark">
              <FormSelect
                control={control}
                name="watermarkKind"
                id="rs-watermark"
                options={[
                  { value: "none", label: "None" },
                  { value: "CONFIDENTIAL", label: "Confidential" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "custom", label: "Custom text" },
                ]}
              />
            </FormField>
            {watermarkKind === "custom" && (
              <FormField label="Watermark text" htmlFor="rs-wm-text" error={errors.watermarkText} required>
                <Input id="rs-wm-text" maxLength={40} aria-invalid={Boolean(errors.watermarkText)} {...register("watermarkText")} />
              </FormField>
            )}
            <FormField label="Signature line" htmlFor="rs-sign" error={errors.signatureLabel} description="Empty = no signature line">
              <Input id="rs-sign" maxLength={60} placeholder="e.g. Authorised signatory" {...register("signatureLabel")} />
            </FormField>

            <FormActions span="md">
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? <Spinner /> : <Save />} Save
              </Button>
              <Button type="button" variant="outline" disabled={previewing} onClick={preview}>
                {previewing ? <Spinner /> : <Eye />} Preview PDF
              </Button>
            </FormActions>
          </FormGrid>
        </form>
      </FormCard>
    </div>
  );
}
