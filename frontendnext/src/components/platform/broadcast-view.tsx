"use client";

// Super Admin: message companies — admins or everyone — in the app, optionally by email too
import { useEffect, useState } from "react";
import { Megaphone, Send, Users } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { FormCard, FormGrid } from "@/components/common/form-layout";
import { MultiSelect } from "@/components/common/multi-select";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { timeAgo } from "@/lib/format";
import { platformService, type BroadcastInput } from "@/lib/services/platform-companies";
import { usePlatformCompaniesStore } from "@/stores/platform-companies-store";

type History = Awaited<ReturnType<typeof platformService.broadcastHistory>>;
const EMPTY: BroadcastInput = { title: "", message: "", audience: "admins", companyIds: [], email: false };

export function BroadcastView() {
  const companies = usePlatformCompaniesStore((s) => s.list);
  const loadCompanies = usePlatformCompaniesStore((s) => s.load);
  const [form, setForm] = useState<BroadcastInput>(EMPTY);
  const [preview, setPreview] = useState<{ companies: number; people: number } | null>(null);
  const [history, setHistory] = useState<History>([]);
  const [busy, setBusy] = useState<"check" | "send" | null>(null);

  useEffect(() => {
    if (!usePlatformCompaniesStore.getState().loaded) void loadCompanies();
    let cancelled = false;
    run(() => platformService.broadcastHistory(), { silent: true }).then((r) => !cancelled && r.ok && setHistory(r.data));
    return () => {
      cancelled = true;
    };
  }, [loadCompanies]);

  const set = <K extends keyof BroadcastInput>(k: K, v: BroadcastInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "audience" || k === "companyIds") setPreview(null);
  };
  const ready = form.title.trim().length >= 3 && form.message.trim().length >= 3;

  async function check() {
    setBusy("check");
    const r = await run(() => platformService.broadcast({ ...form, dryRun: true }));
    setBusy(null);
    if (r.ok) setPreview(r.data);
  }

  async function send() {
    if (!preview || !window.confirm(`Send "${form.title}" to ${preview.people} people in ${preview.companies} companies${form.email ? " (with email)" : ""}?`)) return;
    setBusy("send");
    const r = await run(() => platformService.broadcast(form), { success: (d) => `Sent to ${d.people} people` });
    setBusy(null);
    if (!r.ok) return;
    setForm(EMPTY);
    setPreview(null);
    const h = await run(() => platformService.broadcastHistory(), { silent: true });
    if (h.ok) setHistory(h.data);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Broadcast" description="Send a message to companies. It appears in their bell; tick email to also send it to their inbox." className="mb-0" />

      <FormCard title="New message" icon={Megaphone}>
        <FormGrid>
          <FormField label="Title" htmlFor="bc-title" required span="lg">
            <Input id="bc-title" maxLength={150} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="New: biometric attendance import" />
          </FormField>
          <FormField label="Message" htmlFor="bc-msg" required span="full">
            <Textarea id="bc-msg" rows={4} maxLength={2000} value={form.message} onChange={(e) => set("message", e.target.value)} />
          </FormField>
          <FormField label="Who gets it" htmlFor="bc-aud">
            <SelectField
              id="bc-aud"
              value={form.audience}
              onValueChange={(v) => set("audience", v as BroadcastInput["audience"])}
              options={[
                { value: "admins", label: "Company admins" },
                { value: "everyone", label: "Everyone (all users)" },
              ]}
            />
          </FormField>
          <FormField label="Companies" htmlFor="bc-cos" span="md" description="Leave empty for every active company.">
            <MultiSelect id="bc-cos" value={form.companyIds.map(String)} onChange={(v) => set("companyIds", v.map(Number))} options={companies.filter((c) => c.status === "active").map((c) => ({ value: String(c.id), label: c.name }))} placeholder="All active companies" />
          </FormField>
          <label className="col-span-12 flex items-center gap-2 text-sm">
            <Switch checked={form.email} onCheckedChange={(v) => set("email", v)} aria-label="Also send by email" /> Also send by email
          </label>
        </FormGrid>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <Button variant="outline" disabled={!ready || busy !== null} onClick={check}>
            {busy === "check" ? <Spinner /> : <Users />} Check who gets it
          </Button>
          {preview && (
            <span className="text-sm">
              <strong>{preview.people}</strong> people in <strong>{preview.companies}</strong> compan{preview.companies === 1 ? "y" : "ies"}
            </span>
          )}
          <Button className="ml-auto" disabled={!ready || !preview || !preview.people || busy !== null} onClick={send}>
            {busy === "send" ? <Spinner /> : <Send />} Send
          </Button>
        </div>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Sent before</h2>
        {history.length ? (
          <ul className="divide-y">
            {history.map((h) => (
              <li key={h.id} className="px-4 py-2.5 text-sm">
                {h.summary}
                <span className="block text-xs text-muted-foreground">
                  {h.actor_email ?? "—"} · {timeAgo(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing sent yet.</p>
        )}
      </section>
    </div>
  );
}
