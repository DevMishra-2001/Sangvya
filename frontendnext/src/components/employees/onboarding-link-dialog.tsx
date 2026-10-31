"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { fmtDateTime } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import type { Employee, OnboardingLinkStatus } from "@/lib/types";

const HOURS = [12, 24, 48, 72].map((h) => ({ value: String(h), label: `${h} hours` }));

// HR: a link the employee opens to fill their own details and upload documents
export function OnboardingLinkDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (o: boolean) => void; employee: Employee }) {
  const [status, setStatus] = useState<OnboardingLinkStatus | null | undefined>(undefined);
  const [hours, setHours] = useState("24");
  const [sendEmail, setSendEmail] = useState(Boolean(employee.personal_email || employee.email));
  const [created, setCreated] = useState<{ url: string; expiresAt: string; emailedTo: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    run(() => employeesService.onboardingLink(employee.id), { silent: true }).then((r) => !cancelled && setStatus(r.ok ? r.data : null));
    return () => {
      cancelled = true;
    };
  }, [open, employee.id]);

  function close(o: boolean) {
    if (!o) {
      setCreated(null);
      setCopied(false);
      setStatus(undefined);
    }
    onOpenChange(o);
  }

  async function create() {
    setBusy(true);
    const r = await run(() => employeesService.createOnboardingLink(employee.id, { hours: Number(hours), sendEmail }), {
      success: (d) => (d.emailedTo ? `Link emailed to ${d.emailedTo}` : "Link created"),
    });
    setBusy(false);
    if (r.ok) setCreated(r.data);
  }

  async function revoke() {
    setBusy(true);
    const r = await run(() => employeesService.revokeOnboardingLink(employee.id), { success: "Link stopped" });
    setBusy(false);
    if (r.ok) setStatus((s) => (s ? { ...s, revoked_at: new Date().toISOString() } : s));
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it");
    }
  }

  const active = status && !status.revoked_at && !status.submitted_at && new Date(status.expires_at) > new Date();
  const to = employee.personal_email || employee.email;
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Onboarding link for {employee.name}</DialogTitle>
          <DialogDescription>They open it without logging in, fill their personal, address, bank and ID details, and upload their documents.</DialogDescription>
        </DialogHeader>

        {status === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : created ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} aria-label="Onboarding link" />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <Check /> : <Copy />} Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Works until {fmtDateTime(created.expiresAt)}. Share it only with {employee.name.split(" ")[0]} — anyone with the link can see and edit the form.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {status && (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                {status.submitted_at
                  ? `Submitted on ${fmtDateTime(status.submitted_at)}.`
                  : active
                    ? `A link is open until ${fmtDateTime(status.expires_at)}. A new one replaces it.`
                    : status.revoked_at
                      ? "The last link was stopped or replaced."
                      : `The last link expired on ${fmtDateTime(status.expires_at)}.`}
              </p>
            )}
            <FormGrid density="dialog">
              <FormField label="Link works for" htmlFor="ol-hours" span="md">
                <SelectField id="ol-hours" value={hours} onValueChange={setHours} options={HOURS} />
              </FormField>
              <label className="col-span-12 flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={sendEmail && Boolean(to)} disabled={!to} onCheckedChange={(v) => setSendEmail(v === true)} />
                {to ? `Also email it to ${to}` : "No email on file — copy the link and share it"}
              </label>
            </FormGrid>
          </div>
        )}

        <DialogFooter>
          {!created && active && (
            <Button variant="outline" onClick={revoke} disabled={busy}>
              Stop current link
            </Button>
          )}
          {created ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <Button onClick={create} disabled={busy || status === undefined}>
              {busy ? <Spinner /> : <Link2 />} {active ? "Create a new link" : "Create link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
