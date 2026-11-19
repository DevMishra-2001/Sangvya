"use client";

// Make / edit a letter template: type, letterhead, signatory, the letter text with {{variables}},
// HR's own fields, and a PDF preview (sample data or a real employee)
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, FileText, FileUp, Plus, Save, Trash2, X } from "lucide-react";
import { AuditInfo } from "@/components/common/audit-info";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormCard, FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { lettersService, type LetterCatalog, type LetterField, type LetterheadMode, type LetterTemplate, type LetterType, type TemplateBody, type VariableDef } from "@/lib/services/letters";
import { useAuthStore } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { LetterEditor, type EditorVariable, type LetterEditorHandle, type LetterPaper } from "./letter-editor";

const toBody = (t: LetterTemplate): TemplateBody => ({
  type: t.type,
  name: t.name,
  title: t.title,
  letterheadMode: t.letterhead_mode,
  pageNumbers: t.page_numbers,
  letterheadPath: t.letterhead_path,
  letterheadName: t.letterhead_name,
  marginTop: t.margin_top,
  marginBottom: t.margin_bottom,
  marginLeft: t.margin_left,
  marginRight: t.margin_right,
  body: t.body,
  fields: t.fields,
  signatoryName: t.signatory_name,
  signatoryTitle: t.signatory_title,
  signaturePath: t.signature_path,
  numberPrefix: t.number_prefix,
  isActive: t.is_active,
});

const HEAD_HINT: Record<LetterheadMode, string> = {
  company: "Logo, name and address from the company profile — same as reports",
  upload: "Your letterhead PDF or image, behind every page",
  none: "For pre-printed letterhead paper",
};

const slug = (label: string, taken: Set<string>) => {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1").slice(0, 26) || "field";
  let key = base.length < 2 ? `${base}_x` : base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
};

// Upload button for the letterhead / signature
function FilePick({ kind, name, onPicked, onClear }: { kind: "letterhead" | "signature"; name: string | null; onPicked: (f: { path: string; name: string }) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={kind === "letterhead" ? "application/pdf,image/png,image/jpeg" : "image/png,image/jpeg"}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          const r = await run(() => lettersService.upload(kind, file), { success: kind === "letterhead" ? "Letterhead uploaded" : "Signature uploaded" });
          setBusy(false);
          if (r.ok) onPicked(r.data);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Spinner /> : <FileUp />} {name ? "Replace" : kind === "letterhead" ? "Upload letterhead" : "Upload signature"}
      </Button>
      {name && (
        <span className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
          <FileText className="size-3" /> <span className="max-w-48 truncate">{name}</span>
          <button type="button" aria-label="Remove" onClick={onClear} className="text-muted-foreground hover:text-destructive">
            <X className="size-3" />
          </button>
        </span>
      )}
    </div>
  );
}

export function TemplateEditorView({ id }: { id: string }) {
  const router = useRouter();
  const url = useUrlParams();
  const isNew = id === "new";
  const editorRef = useRef<LetterEditorHandle>(null);
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [catalog, setCatalog] = useState<LetterCatalog | null>(null);
  const companyName = useAuthStore((s) => s.company?.name ?? "");
  const [headImage, setHeadImage] = useState<{ path: string; url: string | null } | null>(null);
  const [saved, setSaved] = useState<LetterTemplate | null>(null);
  const [f, setF] = useState<TemplateBody | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; employeeId: string; loading: boolean } | null>(null);

  // The variables list, then the template (or a starter for a new one)
  useEffect(() => {
    let cancelled = false;
    run(lettersService.variables).then((r) => !cancelled && r.ok && setCatalog(r.data));
    if (isNew) {
      const type = (url.get("type") || "offer") as LetterType;
      run(() => lettersService.starter(type)).then((r) => {
        if (cancelled || !r.ok) return;
        setF({
          type,
          name: r.data.title,
          title: r.data.title,
          letterheadMode: "company",
          pageNumbers: true,
          letterheadPath: null,
          letterheadName: null,
          marginTop: 120,
          marginBottom: 90,
          marginLeft: 60,
          marginRight: 60,
          body: r.data.body,
          fields: r.data.fields,
          signatoryName: null,
          signatoryTitle: null,
          signaturePath: null,
          numberPrefix: r.data.numberPrefix,
          isActive: true,
        });
      });
    } else {
      run(() => lettersService.template(Number(id))).then((r) => {
        if (cancelled || !r.ok) return;
        setSaved(r.data);
        setF(toBody(r.data));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [id, isNew, url]);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of catalog?.variables ?? []) map[v.key] = v.label;
    for (const fl of f?.fields ?? []) map[fl.key] = fl.label;
    return map;
  }, [catalog, f?.fields]);
  const groups = useMemo(() => {
    const g = new Map<string, VariableDef[]>();
    for (const v of catalog?.variables ?? []) g.set(v.group, [...(g.get(v.group) ?? []), v]);
    return [...g.entries()];
  }, [catalog]);

  // Page 1 of an uploaded letterhead, shown behind the editor's pages
  const headPath = f?.letterheadMode === "upload" ? f.letterheadPath : null;
  useEffect(() => {
    if (!headPath) return;
    let cancelled = false;
    let made: string | null = null;
    run(() => lettersService.letterheadImage(headPath), { silent: true }).then((r) => {
      made = r.ok ? r.data : null;
      if (cancelled) {
        if (made) URL.revokeObjectURL(made);
        return;
      }
      setHeadImage({ path: headPath, url: made });
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [headPath]);

  const editorVars = useMemo<EditorVariable[]>(
    () => [...(catalog?.variables ?? []), ...(f?.fields ?? []).map((x) => ({ key: x.key, label: x.label, group: "Fields HR fills in" }))],
    [catalog, f?.fields],
  );
  const signOff = f && (f.signatoryName || f.signatoryTitle || f.signaturePath) ? { company: catalog?.letterhead.name || companyName, name: f.signatoryName, title: f.signatoryTitle, signature: Boolean(f.signaturePath) } : null;
  const signKey = JSON.stringify(signOff);
  const paper = useMemo<LetterPaper | null>(
    () =>
      f && catalog
        ? {
            mode: f.letterheadMode,
            company: catalog.letterhead,
            imageUrl: headImage && headImage.path === headPath ? headImage.url : null,
            margins: { top: f.marginTop, bottom: f.marginBottom, left: f.marginLeft, right: f.marginRight },
            pageNumbers: f.pageNumbers,
            signOff: signKey === "null" ? null : (JSON.parse(signKey) as LetterPaper["signOff"]),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f?.letterheadMode, f?.marginTop, f?.marginBottom, f?.marginLeft, f?.marginRight, f?.pageNumbers, catalog, headImage, headPath, signKey],
  );

  if (!f || !catalog || !paper) return <Skeleton className="h-[70vh] rounded-xl" />;
  const set = <K extends keyof TemplateBody>(k: K) => (v: TemplateBody[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const setField = (i: number, patch: Partial<LetterField>) => set("fields")(f.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addField = () => {
    const taken = new Set([...f.fields.map((x) => x.key), ...catalog.variables.map((v) => v.key)]);
    set("fields")([...f.fields, { key: slug("New field", taken), label: "New field", type: "text", required: false }]);
  };

  async function changeType(type: LetterType) {
    if (!isNew) return set("type")(type);
    const r = await run(() => lettersService.starter(type));
    if (r.ok) setF((x) => (x ? { ...x, type, name: r.data.title, title: r.data.title, body: r.data.body, fields: r.data.fields, numberPrefix: r.data.numberPrefix } : x));
  }

  async function showPreview(employeeId = "") {
    if (!f) return;
    setPreview((p) => ({ url: p?.url ?? null, employeeId, loading: true }));
    const r = await run(() => lettersService.previewTemplate(f, employeeId ? Number(employeeId) : undefined));
    setPreview((p) => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return { url: r.ok ? r.data : null, employeeId, loading: false };
    });
  }

  async function save() {
    if (!f) return;
    setBusy(true);
    const r = await run(() => lettersService.saveTemplate(isNew ? null : Number(id), f), { success: isNew ? "Template created" : "Template saved" });
    setBusy(false);
    if (!r.ok) return;
    setSaved(r.data);
    if (isNew) router.replace(`/letters/templates/${r.data.id}`);
  }

  const margin = (k: "marginTop" | "marginBottom" | "marginLeft" | "marginRight", label: string) => (
    <FormField label={label} htmlFor={`tm-${k}`}>
      <Input id={`tm-${k}`} type="number" min={20} max={320} value={f[k]} onChange={(e) => set(k)(Number(e.target.value || 0))} />
    </FormField>
  );

  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title={isNew ? "New letter template" : `${saved?.name ?? "Letter template"} · v${saved?.version ?? 1}`}
        icon={FileText}
        actions={
          <Button asChild size="sm">
            <Link href="/letters/templates">
              <ArrowLeft /> Back to List
            </Link>
          </Button>
        }
      >
        <FormGrid>
          <FormField label="Letter type" htmlFor="tm-type" required>
            <SelectField id="tm-type" value={f.type} onValueChange={(v) => changeType(v as LetterType)} options={catalog.types.map((t) => ({ value: t.value, label: t.label }))} />
          </FormField>
          <FormField label="Template name" htmlFor="tm-name" required>
            <Input id="tm-name" value={f.name} onChange={(e) => set("name")(e.target.value)} maxLength={120} />
          </FormField>
          <FormField label="Letter title" htmlFor="tm-title" description="Shown in lists, e.g. Offer letter">
            <Input id="tm-title" value={f.title ?? ""} onChange={(e) => set("title")(e.target.value || null)} maxLength={150} />
          </FormField>
          <FormField label="Number prefix" htmlFor="tm-prefix" description={`e.g. ${f.numberPrefix}/2026/0001`}>
            <Input id="tm-prefix" value={f.numberPrefix} onChange={(e) => set("numberPrefix")(e.target.value.toUpperCase())} maxLength={20} />
          </FormField>
          <label className="col-span-12 flex h-9 items-center gap-2 text-sm sm:col-span-6 lg:col-span-4 xl:col-span-2">
            <Switch checked={f.isActive} onCheckedChange={set("isActive")} /> Active
          </label>

          <FieldSeparator label="Letterhead (printed on every page)" />
          <FormField label="Letterhead" htmlFor="tm-head" description={HEAD_HINT[f.letterheadMode]}>
            <SelectField
              id="tm-head"
              value={f.letterheadMode}
              onValueChange={(v) => set("letterheadMode")(v as LetterheadMode)}
              options={[
                { value: "company", label: "Company letterhead" },
                { value: "upload", label: "Upload our letterhead" },
                { value: "none", label: "No letterhead (blank paper)" },
              ]}
            />
          </FormField>
          {f.letterheadMode === "upload" && (
            <div className="col-span-12 flex items-center md:col-span-6 xl:col-span-4">
              <FilePick
                kind="letterhead"
                name={f.letterheadName ?? (f.letterheadPath ? "Letterhead" : null)}
                onPicked={(file) => setF((x) => (x ? { ...x, letterheadPath: file.path, letterheadName: file.name } : x))}
                onClear={() => setF((x) => (x ? { ...x, letterheadPath: null, letterheadName: null } : x))}
              />
            </div>
          )}
          {margin("marginTop", "Top space (pt)")}
          {margin("marginBottom", "Bottom space (pt)")}
          {margin("marginLeft", "Left (pt)")}
          {margin("marginRight", "Right (pt)")}
          <label className="col-span-12 flex h-9 items-center gap-2 text-sm sm:col-span-6 lg:col-span-4 xl:col-span-2">
            <Switch checked={f.pageNumbers} onCheckedChange={set("pageNumbers")} /> Page numbers
          </label>

          <FieldSeparator label="Signed by" />
          <FormField label="Signatory name" htmlFor="tm-sname">
            <Input id="tm-sname" value={f.signatoryName ?? ""} onChange={(e) => set("signatoryName")(e.target.value || null)} maxLength={120} />
          </FormField>
          <FormField label="Signatory title" htmlFor="tm-stitle">
            <Input id="tm-stitle" value={f.signatoryTitle ?? ""} onChange={(e) => set("signatoryTitle")(e.target.value || null)} maxLength={120} />
          </FormField>
          <div className="col-span-12 flex items-center md:col-span-8">
            <FilePick kind="signature" name={f.signaturePath ? "Signature" : null} onPicked={(file) => set("signaturePath")(file.path)} onClear={() => set("signaturePath")(null)} />
          </div>
        </FormGrid>
      </FormCard>

      <div className="grid gap-4 min-[1500px]:grid-cols-[minmax(0,1fr)_300px]">
        <LetterEditor ref={editorRef} value={f.body} onChange={set("body")} labels={labels} variables={editorVars} paper={paper} />

        <aside className="flex flex-col gap-3">
          <section className="rounded-xl border bg-card">
            <h3 className="border-b px-3 py-2 text-[13px] font-semibold">Insert a variable</h3>
            <p className="px-3 pt-2 text-xs text-muted-foreground">Click to put it where the cursor is. It fills in for each employee.</p>
            <div className="flex max-h-[340px] flex-col gap-2 overflow-y-auto p-3">
              {groups.map(([group, vars]) => (
                <div key={group}>
                  <div className="mb-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</div>
                  <div className="flex flex-wrap gap-1">
                    {vars.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => editorRef.current?.insertVariable(v.key, v.block)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                      >
                        {v.block ? "▦ " : ""}
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="text-[13px] font-semibold">Fields HR fills in</h3>
              <Button size="xs" variant="outline" onClick={addField} disabled={f.fields.length >= 15}>
                <Plus /> Add
              </Button>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {f.fields.length === 0 && <p className="text-xs text-muted-foreground">e.g. &ldquo;Probation months&rdquo; or &ldquo;Reason&rdquo; — asked each time a letter is made.</p>}
              {f.fields.map((fl, i) => (
                <div key={i} className="rounded-lg border p-2">
                  <div className="flex gap-1.5">
                    <Input
                      aria-label="Field name"
                      className="h-8"
                      value={fl.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const taken = new Set([...f.fields.filter((_, j) => j !== i).map((x) => x.key), ...catalog.variables.map((v) => v.key)]);
                        setField(i, { label, key: slug(label, taken) });
                      }}
                    />
                    <Button variant="ghost" size="icon-sm" aria-label="Remove field" onClick={() => set("fields")(f.fields.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <SelectField
                      size="sm"
                      className="w-28"
                      aria-label="Field type"
                      value={fl.type}
                      onValueChange={(v) => setField(i, { type: v as LetterField["type"] })}
                      options={[
                        { value: "text", label: "Text" },
                        { value: "textarea", label: "Long text" },
                        { value: "date", label: "Date" },
                        { value: "number", label: "Number" },
                      ]}
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <Switch checked={fl.required} onCheckedChange={(v) => setField(i, { required: v })} /> Required
                    </label>
                    <Button size="xs" variant="secondary" className="ml-auto" onClick={() => editorRef.current?.insertVariable(fl.key)}>
                      Insert
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
        {saved ? <AuditInfo row={saved} /> : <span className="text-xs text-muted-foreground">Not saved yet</span>}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              loadEmployees();
              showPreview("");
            }}
          >
            <Eye /> Preview
          </Button>
          <Button onClick={save} disabled={busy || f.name.trim().length < 2}>
            {busy ? <Spinner /> : <Save />} Save template
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(o) => {
          if (o) return;
          if (preview?.url) URL.revokeObjectURL(preview.url);
          setPreview(null);
        }}
      >
        <DialogContent className="flex h-[92vh] flex-col gap-3 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SelectField
              className="w-72"
              aria-label="Fill with an employee"
              value={preview?.employeeId ?? ""}
              onValueChange={(v) => showPreview(v)}
              searchable
              emptyLabel="Sample data"
              options={employees.filter((e) => e.status !== "exited").map((e) => ({ value: String(e.id), label: e.name }))}
            />
            {preview?.loading && <Spinner />}
          </div>
          {preview?.url ? <iframe title="Letter preview" src={preview.url} className="min-h-0 w-full flex-1 rounded-md border bg-white" /> : <Skeleton className="flex-1" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
