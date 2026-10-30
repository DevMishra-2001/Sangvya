"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Clock, PlayCircle, XCircle } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import { ATTENDANCE_MODES, BUSINESS_TYPES, LEAVE_YEARS, MONTHS, gstState } from "@/lib/company-rules";
import { fmtDate } from "@/lib/format";
import { platformCompaniesService } from "@/lib/services/platform-companies";
import type { CompanyModule, Id, PlatformCompanyDetail } from "@/lib/types";
import { usePlatformCompaniesStore } from "@/stores/platform-companies-store";
import { CompanyStatusBadge, VerificationBadge } from "./company-badges";

const label = <T extends { value: string; label: string }>(list: readonly T[], v: string | null) => list.find((x) => x.value === v)?.label ?? v ?? null;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      <dl className="divide-y rounded-lg border px-3">{children}</dl>
    </section>
  );
}

function Row({ label: name, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{name}</dt>
      <dd className={`min-w-0 text-right break-words ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

// One company, everything about it, and the Super Admin's actions
export function CompanyDetailsSheet({ companyId, onClose }: { companyId: Id | null; onClose: () => void }) {
  const setVerification = usePlatformCompaniesStore((s) => s.setVerification);
  const setStatus = usePlatformCompaniesStore((s) => s.setStatus);
  const [state, setState] = useState<{ id: Id; company?: PlatformCompanyDetail; modules?: CompanyModule[]; error?: string } | null>(null);
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    platformCompaniesService
      .get(companyId)
      .then(({ company, modules }) => !cancelled && setState({ id: companyId, company, modules }))
      .catch((err) => !cancelled && setState({ id: companyId, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const current = state && state.id === companyId ? state : null;
  const c = current?.company;

  async function act(fn: () => Promise<PlatformCompanyDetail | null>) {
    setBusy(true);
    const updated = await fn();
    setBusy(false);
    if (updated && companyId) {
      setState((s) => ({ ...s, id: companyId, company: updated }));
      setNote("");
    }
  }

  async function toggleModule(key: string, enabled: boolean) {
    if (!companyId) return;
    setSavingModule(key);
    const result = await run(() => platformCompaniesService.setModules(companyId, { [key]: enabled }), {
      success: `${current?.modules?.find((m) => m.key === key)?.name} switched ${enabled ? "on" : "off"}`,
    });
    setSavingModule(null);
    if (result.ok) setState((s) => (s && s.id === companyId ? { ...s, modules: result.data } : s));
  }

  return (
    <Sheet
      open={companyId !== null}
      onOpenChange={(open) => {
        if (!open) {
          setNote("");
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {!c ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            <SheetTitle className="sr-only">Company</SheetTitle>
            {current?.error ?? <Spinner />}
          </div>
        ) : (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-center gap-3">
                <CompanyLogo name={c.name} logoUrl={c.logo_url} className="size-11 rounded-xl text-lg" />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg">{c.name}</SheetTitle>
                  <SheetDescription className="truncate">{c.legal_name || label(BUSINESS_TYPES, c.business_type) || "—"}</SheetDescription>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <VerificationBadge status={c.verification_status} />
                <CompanyStatusBadge status={c.status} />
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Actions */}
              <section className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note — required to reject or suspend (e.g. GSTIN doesn't match the legal name)"
                  aria-label="Review note"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || c.verification_status === "verified"} onClick={() => act(() => setVerification(c.id, "verified", note || undefined))}>
                    <CheckCircle2 /> Verify
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || c.verification_status === "pending"} onClick={() => act(() => setVerification(c.id, "pending", note || undefined))}>
                    <Clock /> Mark in review
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || !note.trim()} onClick={() => act(() => setVerification(c.id, "rejected", note))} title={note.trim() ? undefined : "Write a note first"}>
                    <XCircle /> Reject
                  </Button>
                  <span className="flex-1" />
                  {c.status === "suspended" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => setStatus(c.id, "active"))}>
                      <PlayCircle /> Reactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" disabled={busy || !note.trim()} onClick={() => act(() => setStatus(c.id, "suspended", note))} title={note.trim() ? undefined : "Write the reason first"}>
                      <Ban /> Suspend
                    </Button>
                  )}
                </div>
                {(c.verification_notes || c.status_reason) && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {c.verification_notes && (
                      <p>
                        <span className="font-medium text-foreground">Review note:</span> {c.verification_notes}
                        {c.verified_at && ` · verified ${fmtDate(c.verified_at)}`}
                      </p>
                    )}
                    {c.status === "suspended" && c.status_reason && (
                      <p>
                        <span className="font-medium text-destructive">Suspended:</span> {c.status_reason}
                        {c.status_changed_at && ` · since ${fmtDate(c.status_changed_at)}`}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {current?.modules && (
                <section>
                  <h3 className="mb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">Modules</h3>
                  <div className="divide-y rounded-lg border px-3">
                    {current.modules.map((m) => (
                      <label key={m.key} className="flex cursor-pointer items-center justify-between gap-4 py-2">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{m.name}</span>
                          <span className="block text-xs text-muted-foreground">{m.description}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          {savingModule === m.key && <Spinner className="size-3.5" />}
                          <Switch checked={m.enabled} disabled={savingModule !== null} onCheckedChange={(on) => toggleModule(m.key, on)} aria-label={`${m.name} module`} />
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Switching a module off hides its pages and blocks its actions for everyone in this company.</p>
                </section>
              )}

              <Section title="Overview">
                <Row label="Owner" value={c.owners.map((o) => `${o.name} (${o.email})`).join(", ")} />
                <Row label="Employees / logins" value={`${c.employee_count} / ${c.user_count}`} />
                <Row label="Plan" value={c.subscription_status ? `${c.subscription_status}${c.subscription_status === "trial" && c.trial_ends_at ? ` · until ${fmtDate(c.trial_ends_at)}` : ""}` : null} />
                <Row label="Joined" value={fmtDate(c.created_at)} />
              </Section>

              <Section title="Basic">
                <Row label="Business type" value={label(BUSINESS_TYPES, c.business_type)} />
                <Row label="Industry" value={c.industry} />
                <Row label="Employee count" value={c.employee_range} />
                <Row label="Website" value={c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{c.website}</a>} />
                <Row label="Established" value={c.year_established} />
              </Section>

              <Section title="Legal & billing">
                <Row label="PAN" value={c.pan} mono />
                <Row label="GSTIN" value={c.gstin && `${c.gstin}${gstState(c.gstin) ? ` · ${gstState(c.gstin)}` : ""}`} mono />
                <Row label="CIN / LLPIN" value={c.cin_llpin} mono />
                <Row label="TAN" value={c.tan} mono />
                <Row label="Billing address" value={c.billing_address} />
              </Section>

              <Section title="Contact & address">
                <Row label="Email" value={c.email} />
                <Row label="Phone" value={c.phone} />
                <Row label="Registered address" value={[c.address, c.city, c.state, c.postal_code, c.country].filter(Boolean).join(", ")} />
                <Row label="Other offices" value={c.office_locations} />
                <Row label="Timezone" value={c.timezone} />
              </Section>

              <Section title="Workplace">
                <Row label="Work week" value={c.work_days?.split(",").map((d) => d[0].toUpperCase() + d.slice(1)).join(", ")} />
                <Row label="Office hours" value={c.office_start && c.office_end ? `${c.office_start} – ${c.office_end}` : null} />
                <Row label="Attendance" value={label(ATTENDANCE_MODES, c.attendance_mode)} />
                <Row label="Leave year" value={label(LEAVE_YEARS, c.leave_year)} />
                <Row label="Fiscal year starts" value={c.fiscal_year_start ? MONTHS[c.fiscal_year_start - 1] : null} />
                <Row label="Currency" value={c.currency} />
                <Row label="Employee ID prefix" value={c.employee_id_prefix} />
              </Section>
              <Separator className="opacity-0" />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
