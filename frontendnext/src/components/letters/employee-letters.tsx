"use client";

// On an employee's profile: their letters, letters worth making now, and "Generate letter"
// (pick a template → values filled from records, HR edits → preview → save draft or issue)
import { useCallback, useEffect, useState } from "react";
import { Eye, FilePlus2, FileText, Lightbulb, Pencil, Send, Save, Trash2 } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDateTime } from "@/lib/format";
import { lettersService, type EmployeeLetter, type LetterForm, type LetterSuggestion } from "@/lib/services/letters";
import type { Id } from "@/lib/types";

type Data = Awaited<ReturnType<typeof lettersService.forEmployee>>;

function GenerateDialog({ employeeId, employeeName, templates, start, onClose, onDone }: {
  employeeId: Id;
  employeeName: string;
  templates: Data["templates"];
  start: { templateId: Id; letter?: EmployeeLetter } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [templateId, setTemplateId] = useState(start ? String(start.templateId) : "");
  const [form, setForm] = useState<LetterForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>(start?.letter?.values ?? {});
  const [pdf, setPdf] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "draft" | "issue" | null>(null);

  // The template's form: values from records + its own fields
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    queueMicrotask(() => setForm(null));
    run(() => lettersService.form(employeeId, Number(templateId))).then((r) => {
      if (cancelled || !r.ok) return;
      setForm(r.data);
      setValues((v) => ({ ...Object.fromEntries(r.data.auto.map((a) => [a.key, a.value])), ...(start?.letter?.values ?? {}), ...v }));
    });
    return () => {
      cancelled = true;
    };
  }, [employeeId, templateId, start?.letter?.values]);

  useEffect(() => () => void (pdf && URL.revokeObjectURL(pdf)), [pdf]);

  const set = (k: string) => (v: string) => setValues((x) => ({ ...x, [k]: v }));
  const body = () => ({ templateId: Number(templateId), values, issue: false });
  async function preview() {
    setBusy("preview");
    const r = await run(() => lettersService.previewLetter(employeeId, body()));
    setBusy(null);
    if (r.ok) setPdf(r.data);
  }
  async function save(issue: boolean) {
    setBusy(issue ? "issue" : "draft");
    const r = await run(() => lettersService.save(employeeId, start?.letter?.id ?? null, { ...body(), issue }), {
      success: (l) => (issue ? `Letter ${l.code ?? ""} issued — ${employeeName} has been told` : "Draft saved"),
    });
    setBusy(null);
    if (r.ok) onDone();
  }
  const requiredMissing = (form?.fields ?? []).filter((f) => f.required && !values[f.key]?.trim());

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{start?.letter ? `Draft: ${start.letter.title}` : "Generate letter"}</DialogTitle>
          <DialogDescription>For {employeeName}. Values come from their record — change any of them for this letter only.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3">
            <FormGrid density="dialog">
              <FormField label="Template" htmlFor="gl-template" span="full" required>
                <SelectField id="gl-template" value={templateId} onValueChange={setTemplateId} disabled={Boolean(start?.letter)} options={templates.map((t) => ({ value: String(t.id), label: t.name }))} />
              </FormField>
              {!form && templateId && <Skeleton className="col-span-12 h-40" />}
              {form && form.fields.length > 0 && <FieldSeparator label="Fill in" />}
              {form?.fields.map((f) => (
                <FormField key={f.key} label={f.label} htmlFor={`gl-${f.key}`} required={f.required} span={f.type === "textarea" ? "full" : "md"}>
                  {f.type === "date" ? (
                    <DatePicker id={`gl-${f.key}`} value={values[f.key] ?? ""} onChange={set(f.key)} />
                  ) : f.type === "textarea" ? (
                    <Textarea id={`gl-${f.key}`} rows={3} value={values[f.key] ?? ""} onChange={(e) => set(f.key)(e.target.value)} />
                  ) : (
                    <Input id={`gl-${f.key}`} type={f.type === "number" ? "number" : "text"} value={values[f.key] ?? ""} onChange={(e) => set(f.key)(e.target.value)} />
                  )}
                </FormField>
              ))}
              {form && form.auto.length > 0 && <FieldSeparator label="From their record" />}
              {form?.auto.map((a) => (
                <FormField key={a.key} label={a.label} htmlFor={`gl-${a.key}`} span="md" description={!a.value ? "Not in their record" : undefined}>
                  <Input id={`gl-${a.key}`} value={values[a.key] ?? ""} onChange={(e) => set(a.key)(e.target.value)} aria-invalid={!values[a.key]} />
                </FormField>
              ))}
            </FormGrid>
          </div>
          <div className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border bg-muted/30">
            {pdf ? (
              <iframe title="Letter preview" src={pdf} className="min-h-[60vh] w-full flex-1 bg-white" />
            ) : (
              <div className="m-auto flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <FileText className="size-8" />
                Fill the details, then preview the letter here.
                <Button variant="outline" size="sm" onClick={preview} disabled={!form || busy !== null}>
                  {busy === "preview" ? <Spinner /> : <Eye />} Preview
                </Button>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {pdf && (
            <Button variant="outline" onClick={preview} disabled={busy !== null} className="mr-auto">
              {busy === "preview" ? <Spinner /> : <Eye />} Refresh preview
            </Button>
          )}
          <Button variant="outline" onClick={() => save(false)} disabled={!form || busy !== null}>
            {busy === "draft" ? <Spinner /> : <Save />} Save draft
          </Button>
          <Button onClick={() => save(true)} disabled={!form || busy !== null || requiredMissing.length > 0} title={requiredMissing.length ? `Fill in: ${requiredMissing.map((f) => f.label).join(", ")}` : undefined}>
            {busy === "issue" ? <Spinner /> : <Send />} Issue letter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeLetters({ employeeId, employeeName }: { employeeId: Id; employeeName: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);
  const [start, setStart] = useState<{ templateId: Id; letter?: EmployeeLetter } | null | false>(false);

  useEffect(() => {
    let cancelled = false;
    run(() => lettersService.forEmployee(employeeId), { silent: true }).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [employeeId, version]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  if (!data) return null;
  const use = (s: LetterSuggestion) => setStart({ templateId: s.template.id });

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <FormHeading
        title={`Letters · ${data.letters.length}`}
        icon={FileText}
        actions={
          <Button size="sm" onClick={() => setStart(null)} disabled={!data.templates.length}>
            <FilePlus2 /> Generate letter
          </Button>
        }
      />
      {data.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-warning/5 px-3 py-2 text-xs">
          <Lightbulb className="size-4 text-warning" />
          {data.suggestions.map((s) => (
            <button key={s.type} type="button" onClick={() => use(s)} className="rounded-full border border-warning/40 bg-background px-2.5 py-1 font-medium hover:bg-warning/10">
              {s.label} <span className="text-muted-foreground">· {s.reason}</span>
            </button>
          ))}
        </div>
      )}
      {!data.templates.length && <p className="p-4 text-sm text-muted-foreground">No letter templates yet — add one in Settings → Letter Templates.</p>}
      {data.letters.length === 0 && data.templates.length > 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">No letters for {employeeName} yet.</p>
      ) : (
        <ul className="divide-y">
          {data.letters.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{l.title}</span>
              {l.code && <span className="font-mono text-xs text-primary">{l.code}</span>}
              <StatusBadge tone={l.status === "issued" ? "success" : "warning"} className="normal-case">
                {l.status === "issued" ? "Issued" : "Draft"}
              </StatusBadge>
              <span className="text-xs text-muted-foreground">
                {l.status === "issued" ? `Issued by ${l.issued_by_name ?? "—"} · ${fmtDateTime(l.issued_at)}` : `Saved by ${l.updated_by_name ?? l.created_by_name ?? "—"} · ${fmtDateTime(l.updated_at)}`}
              </span>
              <span className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Open ${l.title}`} onClick={() => run(() => lettersService.openPdf(l.id))}>
                  <Eye />
                </Button>
                {l.status === "draft" && l.template_id && (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Continue draft" onClick={() => setStart({ templateId: l.template_id!, letter: l })}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete draft" onClick={async () => (await run(() => lettersService.remove(l.id), { success: "Draft deleted" })).ok && refresh()}>
                      <Trash2 />
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {start !== false && (
        <GenerateDialog
          key={start ? `${start.templateId}-${start.letter?.id ?? "new"}` : "pick"}
          employeeId={employeeId}
          employeeName={employeeName}
          templates={data.templates}
          start={start}
          onClose={() => setStart(false)}
          onDone={() => {
            setStart(false);
            refresh();
          }}
        />
      )}
    </section>
  );
}
