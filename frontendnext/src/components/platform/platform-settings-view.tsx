"use client";

// Super Admin: platform-wide values that used to live in code (price, trial, link expiry, banner …)
import { useEffect, useState } from "react";
import { CreditCard, LifeBuoy, Megaphone, RotateCcw, Save, ShieldCheck, Building2 } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { FormCard, FormGrid } from "@/components/common/form-layout";
import { MultiSelect } from "@/components/common/multi-select";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDateTime } from "@/lib/format";
import { platformService, type PlatformSettings, type SettingsResponse } from "@/lib/services/platform-companies";
import { useAuthStore } from "@/stores/auth-store";

type NumKey = { [K in keyof PlatformSettings]: PlatformSettings[K] extends number ? K : never }[keyof PlatformSettings];

export function PlatformSettingsView() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const loadMe = useAuthStore((s) => s.loadMe);

  useEffect(() => {
    let cancelled = false;
    run(() => platformService.settings()).then((r) => {
      if (cancelled || !r.ok) return;
      setData(r.data);
      setForm(r.data.settings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || !form) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const num = (key: NumKey) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, (e.target.value === "" ? "" : Number(e.target.value)) as never),
    type: "number",
    inputMode: "numeric" as const,
  });
  const hint = (key: keyof PlatformSettings) => (JSON.stringify(form[key]) !== JSON.stringify(data.defaults[key]) ? `Default: ${Array.isArray(data.defaults[key]) ? "all" : String(data.defaults[key]) || "—"}` : undefined);
  const dirty = JSON.stringify(form) !== JSON.stringify(data.settings);

  async function save() {
    if (!form) return;
    setSaving(true);
    const r = await run(() => platformService.saveSettings(form), { success: "Settings saved" });
    setSaving(false);
    if (!r.ok) return;
    setData(r.data);
    setForm(r.data.settings);
    void loadMe(); // my own banner updates too
  }

  return (
    <div className="flex flex-col gap-5 pb-20">
      <PageHeader
        title="Platform settings"
        description={`Values for the whole platform. Secrets (keys, passwords) stay in the server's .env.${data.updatedAt ? ` Last saved ${fmtDateTime(data.updatedAt)}.` : ""}`}
        className="mb-0"
      />

      <FormCard title="Pricing & trial" icon={CreditCard}>
        <FormGrid>
          <FormField label="Price per employee / month (₹)" htmlFor="ps-price" description={hint("pricePerEmployee") ?? "For new companies. Change one company's price from Companies."}>
            <Input id="ps-price" min={0} step="0.5" {...num("pricePerEmployee")} />
          </FormField>
          <FormField label="Free trial (days)" htmlFor="ps-trial" description={hint("trialDays") ?? "Given to every new company."}>
            <Input id="ps-trial" min={0} max={365} {...num("trialDays")} />
          </FormField>
          <FormField label="Razorpay plan ID" htmlFor="ps-plan" span="md" description="Razorpay charges the plan's own price — after changing the price, create a matching plan in Razorpay and paste its ID here.">
            <Input id="ps-plan" value={form.razorpayPlanId} onChange={(e) => set("razorpayPlanId", e.target.value)} placeholder="plan_…" />
          </FormField>
        </FormGrid>
      </FormCard>

      <FormCard title="New companies" icon={Building2}>
        <FormGrid>
          <FormField label="Modules switched on" htmlFor="ps-mods" span="lg" description="What a newly created company gets. Change existing companies from the Companies page.">
            <MultiSelect id="ps-mods" value={form.newCompanyModules} onChange={(v) => set("newCompanyModules", v)} options={data.modules.map((m) => ({ value: m.key, label: m.name }))} placeholder="Only the core (no extra modules)" />
          </FormField>
        </FormGrid>
        <p className="mt-3 text-xs text-muted-foreground">Work hours, breaks, grace time and leave rules are set by each company (Shifts, Leave Policy), not here.</p>
      </FormCard>

      <FormCard title="Sign-in & links" icon={ShieldCheck}>
        <FormGrid>
          <FormField label="Log out after inactivity (minutes)" htmlFor="ps-idle" description={hint("sessionIdleMinutes")}>
            <Input id="ps-idle" min={5} max={480} {...num("sessionIdleMinutes")} />
          </FormField>
          <FormField label="Log in again after (hours)" htmlFor="ps-max" description={hint("sessionMaxHours") ?? "Even if active the whole time."}>
            <Input id="ps-max" min={1} max={72} {...num("sessionMaxHours")} />
          </FormField>
          <FormField label="Invite links valid for (hours)" htmlFor="ps-invite" description={hint("inviteLinkHours")}>
            <Input id="ps-invite" min={1} max={720} {...num("inviteLinkHours")} />
          </FormField>
        </FormGrid>
      </FormCard>

      <FormCard title="Support contact" icon={LifeBuoy}>
        <FormGrid>
          <FormField label="Support email" htmlFor="ps-email" description="Shown to companies when they need help.">
            <Input id="ps-email" type="email" value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} placeholder="support@workkind.in" />
          </FormField>
          <FormField label="Support phone / WhatsApp" htmlFor="ps-phone">
            <Input id="ps-phone" type="tel" value={form.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} />
          </FormField>
        </FormGrid>
      </FormCard>

      <FormCard
        title="Message for everyone"
        icon={Megaphone}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.bannerEnabled} onCheckedChange={(v) => set("bannerEnabled", v)} aria-label="Show the message" />
            {form.bannerEnabled ? "Showing" : "Off"}
          </label>
        }
      >
        <FormGrid>
          <FormField label="Message" htmlFor="ps-banner" span="lg" description="A strip at the top of the app for every user of every company — maintenance, new features …">
            <Textarea id="ps-banner" rows={2} maxLength={300} value={form.bannerText} onChange={(e) => set("bannerText", e.target.value)} placeholder="Workkind will be down for maintenance tonight 11:00–11:30 PM." />
          </FormField>
          <FormField label="Colour" htmlFor="ps-tone">
            <SelectField
              id="ps-tone"
              value={form.bannerTone}
              onValueChange={(v) => set("bannerTone", v as PlatformSettings["bannerTone"])}
              options={[
                { value: "info", label: "Info (blue)" },
                { value: "warning", label: "Warning (amber)" },
                { value: "danger", label: "Urgent (red)" },
              ]}
            />
          </FormField>
        </FormGrid>
      </FormCard>

      {/* Save bar stays in reach on long pages */}
      <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur">
        <span className="mr-auto self-center text-sm text-muted-foreground">{dirty ? "Unsaved changes" : "All saved"}</span>
        <Button variant="outline" disabled={!dirty || saving} onClick={() => setForm(data.settings)}>
          <RotateCcw /> Undo
        </Button>
        <Button disabled={!dirty || saving} onClick={save}>
          {saving ? <Spinner /> : <Save />} Save settings
        </Button>
      </div>
    </div>
  );
}
