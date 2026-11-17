"use client";

// New Ticket (and edit with ?id=): project, category, priority, who does it, who reported it, what it is
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, History, Save, Send } from "lucide-react";
import { AuditInfo } from "@/components/common/audit-info";
import { DatePicker } from "@/components/common/date-picker";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDateTime, isoDate } from "@/lib/format";
import { ticketsService, type Attachment, type Ticket, type TicketBody, type TicketList } from "@/lib/services/tickets";
import { useTicketMeta } from "@/stores/ticket-meta-store";
import { ColorBadge, TicketFilePicker } from "./ticket-shared";

interface Form {
  title: string;
  description: string;
  projectId: string;
  moduleId: string;
  categoryId: string;
  priorityId: string;
  statusId: string;
  assignedTo: string;
  secondaryAssignee: string;
  reportedByName: string;
  reportedByMobile: string;
  pageUrl: string;
  dueDate: string;
  estimateHours: string;
}

const addDays = (n: number) => isoDate(new Date(Date.now() + n * 86_400_000));
const s = (v: unknown) => (v == null ? "" : String(v));

function fromTicket(t: Ticket): Form {
  return {
    title: t.title,
    description: s(t.description),
    projectId: s(t.project_id),
    moduleId: s(t.module_id),
    categoryId: s(t.category_id),
    priorityId: s(t.priority_id),
    statusId: s(t.status_id),
    assignedTo: s(t.assigned_to),
    secondaryAssignee: s(t.secondary_assignee),
    reportedByName: s(t.reported_by_name),
    reportedByMobile: s(t.reported_by_mobile),
    pageUrl: s(t.page_url),
    dueDate: s(t.due_date),
    estimateHours: t.estimate_minutes ? String(Math.round((t.estimate_minutes / 60) * 100) / 100) : "",
  };
}

export function NewTicketView() {
  const router = useRouter();
  const url = useUrlParams();
  const editId = url.getNumber("id", 0) || null;
  const meta = useTicketMeta((x) => x.meta);
  const loadMeta = useTicketMeta((x) => x.load);
  const [form, setForm] = useState<Form | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [dueTouched, setDueTouched] = useState(false);
  const [recent, setRecent] = useState<TicketList | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // A blank form (defaults from settings) or the ticket being edited
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    if (editId) {
      run(() => ticketsService.get(editId)).then((r) => {
        if (cancelled || !r.ok) return;
        setEditing(r.data.ticket);
        setForm(fromTicket(r.data.ticket));
        setFiles(r.data.ticket.attachments);
        setDueTouched(true);
      });
    } else {
      queueMicrotask(() => {
        if (cancelled) return;
        setEditing(null);
        setFiles([]);
        setDueTouched(false);
        setForm((prev) => ({
          title: "",
          description: "",
          // Keep the project / category picked for the last ticket: people raise several in a row
          projectId: prev?.projectId ?? "",
          moduleId: prev?.moduleId ?? "",
          categoryId: prev?.categoryId ?? "",
          priorityId: s(meta.priorities.find((p) => p.is_default && p.is_active)?.id),
          statusId: s(meta.statuses.find((x) => x.is_default)?.id),
          assignedTo: s(meta.settings.allow_self_assign ? meta.me.employeeId : ""),
          secondaryAssignee: "",
          reportedByName: "",
          reportedByMobile: "",
          pageUrl: "",
          dueDate: "",
          estimateHours: "",
        }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [meta, editId, version]);

  // My latest tickets under the form
  useEffect(() => {
    let cancelled = false;
    run(() => ticketsService.list({ scope: "created", limit: 10, sort: "created", order: "desc" }), { silent: true }).then((r) => !cancelled && r.ok && setRecent(r.data));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const people = useMemo(() => (meta?.people ?? []).map((p) => ({ value: String(p.id), label: p.code ? `${p.name} · ${p.code}` : p.name })), [meta]);
  if (!meta || !form) return <Skeleton className="h-96 rounded-xl" />;
  if (!meta.can.create && !editId) return <EmptyState icon={FileText} title="Only managers can raise tickets here" description="Ask your manager to raise it for you." />;

  const f = form;
  const set = (k: keyof Form) => (v: string) => setForm((x) => (x ? { ...x, [k]: v } : x));
  const active = <T extends { is_active: boolean; id: number }>(list: T[], keep: string) => list.filter((x) => x.is_active || String(x.id) === keep);
  const projects = active(meta.projects, f.projectId);
  const modules = active(meta.modules, f.moduleId).filter((m) => String(m.project_id) === f.projectId);
  const categories = active(meta.categories, f.categoryId);
  const priorities = active(meta.priorities, f.priorityId);

  // Picking a category / priority suggests a delivery date until the user picks one
  function suggestDue(categoryId: string, priorityId: string) {
    if (dueTouched) return;
    const c = meta!.categories.find((x) => String(x.id) === categoryId);
    const p = meta!.priorities.find((x) => String(x.id) === priorityId);
    const due = c?.default_days != null ? addDays(c.default_days) : p?.sla_hours ? addDays(Math.ceil(p.sla_hours / 24)) : "";
    setForm((x) => (x ? { ...x, dueDate: due } : x));
  }
  function pickProject(v: string) {
    const p = meta!.projects.find((x) => String(x.id) === v);
    setForm((x) => (x ? { ...x, projectId: v, moduleId: "", assignedTo: !editId && p?.default_assignee_id && !x.assignedTo ? String(p.default_assignee_id) : x.assignedTo } : x));
  }

  async function submit() {
    setBusy(true);
    const n = (v: string) => (v ? Number(v) : null);
    const body: TicketBody = {
      title: f.title,
      description: f.description || null,
      projectId: n(f.projectId),
      moduleId: n(f.moduleId),
      categoryId: n(f.categoryId),
      priorityId: n(f.priorityId),
      statusId: editId ? undefined : n(f.statusId),
      assignedTo: n(f.assignedTo),
      secondaryAssignee: n(f.secondaryAssignee),
      reportedByName: f.reportedByName || null,
      reportedByMobile: f.reportedByMobile || null,
      pageUrl: f.pageUrl || null,
      dueDate: f.dueDate || null,
      estimateMinutes: f.estimateHours ? Math.round(Number(f.estimateHours) * 60) : null,
      attachments: files,
    };
    if (editId) {
      const r = await run(() => ticketsService.update(editId, body), { success: "Ticket saved" });
      setBusy(false);
      if (r.ok) router.push(`/tickets?id=${editId}`);
      return;
    }
    const r = await run(() => ticketsService.create(body), { success: (t) => `${t.code} created` });
    setBusy(false);
    if (r.ok) setVersion((v) => v + 1);
  }

  const missing = f.title.trim().length < 3 || (meta.settings.require_project && !f.projectId);

  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title={editing ? `Edit ${editing.code}` : "New Ticket"}
        icon={FileText}
        actions={
          <Button asChild size="sm">
            <Link href={editId ? `/tickets?id=${editId}` : "/tickets"}>
              <ArrowLeft /> Back to List
            </Link>
          </Button>
        }
      >
        {/* Fresh inputs after each submit, so floating labels drop back down */}
        <FormGrid key={version}>
          <FieldSeparator label="Ticket details" />
          <FormField label="Project" htmlFor="tk-project" required={meta.settings.require_project}>
            <SelectField id="tk-project" value={f.projectId} onValueChange={pickProject} searchable emptyLabel={meta.settings.require_project ? undefined : "No project"} options={projects.map((p) => ({ value: String(p.id), label: p.version ? `${p.name} - ${p.version}` : p.name }))} />
          </FormField>
          <FormField label="Module" htmlFor="tk-module">
            <SelectField id="tk-module" value={f.moduleId} onValueChange={set("moduleId")} searchable emptyLabel="No module" disabled={!f.projectId || modules.length === 0} options={modules.map((m) => ({ value: String(m.id), label: m.name }))} />
          </FormField>
          <FormField label="Category" htmlFor="tk-category">
            <SelectField
              id="tk-category"
              value={f.categoryId}
              onValueChange={(v) => {
                set("categoryId")(v);
                suggestDue(v, f.priorityId);
              }}
              emptyLabel="No category"
              options={categories.map((c) => ({ value: String(c.id), label: <ColorBadge color={c.color} dot>{c.name}</ColorBadge> }))}
            />
          </FormField>
          <FormField label="Priority" htmlFor="tk-priority">
            <SelectField
              id="tk-priority"
              value={f.priorityId}
              onValueChange={(v) => {
                set("priorityId")(v);
                suggestDue(f.categoryId, v);
              }}
              options={priorities.map((p) => ({ value: String(p.id), label: <ColorBadge color={p.color} dot>{p.name}</ColorBadge> }))}
            />
          </FormField>
          <FormField label="Delivery date" htmlFor="tk-due">
            <DatePicker
              id="tk-due"
              value={f.dueDate}
              onChange={(d) => {
                setDueTouched(true);
                set("dueDate")(d);
              }}
              clearable
            />
          </FormField>
          <FormField label="Page / URL" htmlFor="tk-url">
            <Input id="tk-url" value={f.pageUrl} onChange={(e) => set("pageUrl")(e.target.value)} maxLength={500} />
          </FormField>

          <FieldSeparator label="Assignment & reporter" />
          <FormField label="Assign to" htmlFor="tk-assign">
            <SelectField id="tk-assign" value={f.assignedTo} onValueChange={set("assignedTo")} searchable emptyLabel="Nobody yet" options={people} />
          </FormField>
          <FormField label="Secondary assignee" htmlFor="tk-second">
            <SelectField id="tk-second" value={f.secondaryAssignee} onValueChange={set("secondaryAssignee")} searchable emptyLabel="None" options={people.filter((p) => p.value !== f.assignedTo)} />
          </FormField>
          {!editId && (
            <FormField label="Status" htmlFor="tk-status">
              <SelectField
                id="tk-status"
                value={f.statusId}
                onValueChange={set("statusId")}
                options={meta.statuses.filter((x) => x.is_active).map((x) => ({ value: String(x.id), label: <ColorBadge color={x.color} dot>{x.name}</ColorBadge> }))}
              />
            </FormField>
          )}
          <FormField label="Reported by" htmlFor="tk-rname">
            <Input id="tk-rname" value={f.reportedByName} onChange={(e) => set("reportedByName")(e.target.value)} maxLength={120} />
          </FormField>
          <FormField label="Reporter mobile" htmlFor="tk-rmobile">
            <Input id="tk-rmobile" inputMode="tel" value={f.reportedByMobile} onChange={(e) => set("reportedByMobile")(e.target.value)} maxLength={20} />
          </FormField>
          <FormField label="Estimate (hours)" htmlFor="tk-est">
            <Input id="tk-est" type="number" min={0} step={0.25} value={f.estimateHours} onChange={(e) => set("estimateHours")(e.target.value)} />
          </FormField>

          <FieldSeparator label="Description" />
          <FormField label="Title" htmlFor="tk-title" required span="full">
            <Input id="tk-title" value={f.title} onChange={(e) => set("title")(e.target.value)} maxLength={200} />
          </FormField>
          <FormField label="Description" htmlFor="tk-desc" span="full">
            <Textarea id="tk-desc" value={f.description} onChange={(e) => set("description")(e.target.value)} maxLength={10000} rows={4} />
          </FormField>
          <div className="col-span-12 flex flex-wrap items-center gap-2">
            <TicketFilePicker files={files} onChange={setFiles} />
            <span className="flex-1" />
            <Button onClick={submit} disabled={busy || missing}>
              {busy ? <Spinner /> : editId ? <Save /> : <Send />} {editId ? "Save changes" : "Submit"}
            </Button>
          </div>
          {editing && <AuditInfo row={editing} className="col-span-12 border-t pt-3" />}
        </FormGrid>
      </FormCard>

      {!editId && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <FormHeading
            title={`My latest tickets (${recent?.rows.length ?? 0})`}
            icon={History}
            actions={
              <Button asChild size="sm" variant="outline">
                <Link href="/tickets?scope=created">View all</Link>
              </Button>
            }
          />
          {!recent ? (
            <Skeleton className="m-3 h-20" />
          ) : recent.rows.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Tickets you raise show up here.</p>
          ) : (
            <ul className="divide-y">
              {recent.rows.map((t) => (
                <li key={t.id}>
                  <Link href={`/tickets?id=${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted/40">
                    <span className="font-mono text-xs font-semibold text-primary">{t.code}</span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.category_name && <ColorBadge color={t.category_color}>{t.category_name}</ColorBadge>}
                    <ColorBadge color={t.status_color} dot>
                      {t.status_name}
                    </ColorBadge>
                    <span className="w-32 truncate text-xs text-muted-foreground">{t.assigned_to_name ?? "Unassigned"}</span>
                    <span className="hidden w-36 text-right text-xs text-muted-foreground sm:block">{fmtDateTime(t.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
