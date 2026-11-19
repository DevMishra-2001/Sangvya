"use client";

// Ticket Settings: projects, modules, categories, statuses (with colours), priorities and general rules — per company
import { useEffect, useState } from "react";
import { Boxes, CircleDot, Flag, FolderKanban, Pencil, Plus, Save, Settings2, Shapes, Star } from "lucide-react";
import { AuditCell, AuditInfo } from "@/components/common/audit-info";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { ticketsService, type TicketPerson, type SettingList, type StatusKind, type TicketGeneral, type TicketSettingsData } from "@/lib/services/tickets";
import type { Id } from "@/lib/types";
import { useTicketMeta } from "@/stores/ticket-meta-store";
import { ColorBadge, ColorPicker, KIND_LABEL } from "./ticket-shared";

type Row = Record<string, unknown> & { id: Id; name: string };
type Form = Record<string, string | boolean>;

const LABEL: Record<SettingList, string> = { projects: "project", modules: "module", categories: "category", statuses: "status", priorities: "priority" };

// Row → editable form values
// Stable empty list (a new [] in a store selector re-renders forever)
const NO_PEOPLE: TicketPerson[] = [];

function toForm(list: SettingList, r: Row | null): Form {
  const s = (v: unknown) => (v == null ? "" : String(v));
  switch (list) {
    case "projects":
      return { name: s(r?.name), code: s(r?.code), clientName: s(r?.client_name), version: s(r?.version), description: s(r?.description), defaultAssigneeId: s(r?.default_assignee_id), sortOrder: s(r?.sort_order ?? 0), isActive: r ? Boolean(r.is_active) : true };
    case "modules":
      return { projectId: s(r?.project_id), name: s(r?.name), isActive: r ? Boolean(r.is_active) : true };
    case "categories":
      return { name: s(r?.name), color: s(r?.color || "#2563eb"), defaultDays: s(r?.default_days), sortOrder: s(r?.sort_order ?? 0), isActive: r ? Boolean(r.is_active) : true };
    case "statuses":
      return { name: s(r?.name), color: s(r?.color || "#2563eb"), kind: s(r?.kind || "open"), sortOrder: s(r?.sort_order ?? 0), isDefault: Boolean(r?.is_default), isActive: r ? Boolean(r.is_active) : true };
    case "priorities":
      return { name: s(r?.name), color: s(r?.color || "#2563eb"), slaHours: s(r?.sla_hours), sortOrder: s(r?.sort_order ?? 0), isDefault: Boolean(r?.is_default), isActive: r ? Boolean(r.is_active) : true };
  }
}

function SettingDialog({ list, row, data, onClose, onSaved }: { list: SettingList | null; row: Row | null; data: TicketSettingsData; onClose: () => void; onSaved: () => void }) {
  const people = useTicketMeta((s) => s.meta?.people) ?? NO_PEOPLE;
  const [form, setForm] = useState<Form>({});
  const [busy, setBusy] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const key = list ? `${list}:${row?.id ?? "new"}` : null;
  if (key !== openKey) {
    setOpenKey(key);
    if (list) setForm(toForm(list, row));
  }
  if (!list) return null;
  const set = (k: string) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const str = (k: string) => String(form[k] ?? "");

  async function save() {
    if (!list) return;
    setBusy(true);
    const body: Record<string, unknown> = { ...form };
    for (const k of ["sortOrder", "defaultDays", "slaHours", "projectId", "defaultAssigneeId"]) if (k in body) body[k] = body[k] === "" ? null : Number(body[k]);
    if (body.sortOrder === null) body.sortOrder = 0;
    const r = await run(() => ticketsService.saveSetting(list, row?.id ?? null, body), { success: row ? "Saved" : `${LABEL[list][0]!.toUpperCase()}${LABEL[list].slice(1)} added` });
    setBusy(false);
    if (r.ok) onSaved();
  }

  const nameField = (
    <FormField label="Name" htmlFor="st-name" required span={list === "modules" ? "md" : "sm"}>
      <Input id="st-name" value={str("name")} onChange={(e) => set("name")(e.target.value)} maxLength={150} autoFocus />
    </FormField>
  );
  const colour = (
    <FormField label="Colour" float={false} span="lg">
      <ColorPicker value={str("color")} onChange={set("color")} />
    </FormField>
  );
  const order = (
    <FormField label="Order" htmlFor="st-order">
      <Input id="st-order" type="number" min={0} max={999} value={str("sortOrder")} onChange={(e) => set("sortOrder")(e.target.value)} />
    </FormField>
  );
  const toggle = (k: string, label: string) => (
    <label className="col-span-12 flex items-center gap-2 text-sm sm:col-span-6 lg:col-span-3">
      <Switch checked={Boolean(form[k])} onCheckedChange={set(k)} /> {label}
    </label>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${LABEL[list]}` : `New ${LABEL[list]}`}</DialogTitle>
          <DialogDescription>{list === "statuses" ? "The name and colour are yours; “Means” tells the app how to count it (open, working, done…)." : `Shows up in ticket forms and filters.`}</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          {list === "modules" && (
            <FormField label="Project" htmlFor="st-project" required span="md">
              <SelectField id="st-project" value={str("projectId")} onValueChange={set("projectId")} searchable options={data.projects.map((p) => ({ value: String(p.id), label: p.name }))} />
            </FormField>
          )}
          {nameField}
          {list === "projects" && (
            <>
              <FormField label="Code" htmlFor="st-code">
                <Input id="st-code" value={str("code")} onChange={(e) => set("code")(e.target.value.toUpperCase())} maxLength={20} />
              </FormField>
              <FormField label="Client name" htmlFor="st-client">
                <Input id="st-client" value={str("clientName")} onChange={(e) => set("clientName")(e.target.value)} maxLength={150} />
              </FormField>
              <FormField label="Version" htmlFor="st-version">
                <Input id="st-version" value={str("version")} onChange={(e) => set("version")(e.target.value)} maxLength={50} />
              </FormField>
              <FormField label="Default assignee" htmlFor="st-assignee" span="md">
                <SelectField id="st-assignee" value={str("defaultAssigneeId")} onValueChange={set("defaultAssigneeId")} searchable emptyLabel="Nobody" options={people.map((p) => ({ value: String(p.id), label: p.name }))} />
              </FormField>
              {order}
              <FormField label="Description" htmlFor="st-desc" span="full">
                <Textarea id="st-desc" value={str("description")} onChange={(e) => set("description")(e.target.value)} maxLength={1000} rows={2} />
              </FormField>
            </>
          )}
          {list === "categories" && (
            <>
              <FormField label="Default delivery days" htmlFor="st-days" description="Delivery date when none is given">
                <Input id="st-days" type="number" min={0} max={365} value={str("defaultDays")} onChange={(e) => set("defaultDays")(e.target.value)} />
              </FormField>
              {order}
              {colour}
            </>
          )}
          {list === "statuses" && (
            <>
              <FormField label="Means" htmlFor="st-kind" required span="md">
                <SelectField id="st-kind" value={str("kind")} onValueChange={set("kind")} options={(Object.keys(KIND_LABEL) as StatusKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
              </FormField>
              {order}
              {colour}
            </>
          )}
          {list === "priorities" && (
            <>
              <FormField label="SLA (hours)" htmlFor="st-sla" description="Delivery time when the category has none">
                <Input id="st-sla" type="number" min={1} max={8760} value={str("slaHours")} onChange={(e) => set("slaHours")(e.target.value)} />
              </FormField>
              {order}
              {colour}
            </>
          )}
          <FieldSeparator label="Options" />
          {toggle("isActive", "Active")}
          {(list === "statuses" || list === "priorities") && toggle("isDefault", list === "statuses" ? "New tickets start here" : "Default for new tickets")}
        </FormGrid>
        {row && <AuditInfo row={row as never} className="border-t pt-3" />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || str("name").trim().length < 1 || (list === "modules" && !str("projectId"))}>
            {busy ? <Spinner /> : <Save />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveBadge({ on }: { on: boolean }) {
  return on ? <Badge variant="outline" className="border-success/40 text-success">Active</Badge> : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
}

// One list: heading with Add, then the table
function ListTab({
  list,
  rows,
  icon,
  title,
  columns,
  onAdd,
  onEdit,
  onDelete,
}: {
  list: SettingList;
  rows: Row[];
  icon: typeof Boxes;
  title: string;
  columns: { label: string; cell: (r: Row) => React.ReactNode; className?: string }[];
  onAdd: () => void;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <FormHeading
        title={`${title} · ${rows.length}`}
        icon={icon}
        actions={
          <Button size="sm" onClick={onAdd}>
            <Plus /> Add {LABEL[list]}
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} description={`Add your first ${LABEL[list]} to use it on tickets.`} />
      ) : (
        <div className="overflow-x-auto">
          <Table className="border-collapse [&_td]:border [&_th]:border">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">#</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.label} className={c.className}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead>Created By</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead className="w-20 text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.label} className={c.className}>
                      {c.cell(r)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <AuditCell name={r.created_by_name as string | null} at={r.created_at as string | null} />
                  </TableCell>
                  <TableCell>
                    <AuditCell name={r.updated_by_name as string | null} at={r.updated_by ? (r.updated_at as string | null) : null} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`} onClick={() => onEdit(r)}>
                        <Pencil />
                      </Button>
                      {!r.is_default && <ConfirmDelete title={`Delete ${LABEL[list]} "${r.name}"?`} description={Number(r.tickets ?? 0) > 0 ? "It's used by tickets, so it can't be deleted — make it inactive instead." : "This can't be undone."} onConfirm={() => onDelete(r)} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function GeneralTab({ general, onSaved }: { general: TicketGeneral; onSaved: () => void }) {
  const [f, setF] = useState(() => ({
    prefix: general.prefix,
    numberDigits: String(general.number_digits),
    whoCanCreate: general.who_can_create,
    assignAnyone: general.assign_anyone,
    allowSelfAssign: general.allow_self_assign,
    requireProject: general.require_project,
    requireTimeOnDone: general.require_time_on_done,
    autoCloseDays: general.auto_close_days == null ? "" : String(general.auto_close_days),
    notifyOnAssign: general.notify_on_assign,
  }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const preview = `${f.prefix.toUpperCase()}${String(general.next_number).padStart(Number(f.numberDigits) || 4, "0")}`;

  async function save() {
    setBusy(true);
    const r = await run(() => ticketsService.saveGeneral({ ...f, numberDigits: Number(f.numberDigits), autoCloseDays: f.autoCloseDays === "" ? null : Number(f.autoCloseDays) }), { success: "Settings saved" });
    setBusy(false);
    if (r.ok) onSaved();
  }
  const toggle = (k: "assignAnyone" | "allowSelfAssign" | "requireProject" | "requireTimeOnDone" | "notifyOnAssign", label: string, hint: string) => (
    <label className="col-span-12 flex items-start gap-2 rounded-lg border p-2.5 text-sm md:col-span-6 xl:col-span-4">
      <Switch checked={f[k]} onCheckedChange={set(k)} className="mt-0.5" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <FormCard title="General" icon={Settings2}>
      <FormGrid>
        <FieldSeparator label="Ticket number" />
        <FormField label="Prefix" htmlFor="g-prefix" required>
          <Input id="g-prefix" value={f.prefix} onChange={(e) => set("prefix")(e.target.value.toUpperCase())} maxLength={10} />
        </FormField>
        <FormField label="Digits" htmlFor="g-digits">
          <SelectField id="g-digits" value={f.numberDigits} onValueChange={set("numberDigits")} options={["2", "3", "4", "5", "6"].map((d) => ({ value: d, label: d }))} />
        </FormField>
        <div className="col-span-12 flex h-9 items-center text-sm sm:col-span-6 lg:col-span-4 xl:col-span-2">
          Next ticket: <span className="ml-1.5 font-mono font-semibold text-primary">{preview}</span>
        </div>
        <FieldSeparator label="Who can do what" />
        <FormField label="Who can raise tickets" htmlFor="g-who" span="md">
          <SelectField
            id="g-who"
            value={f.whoCanCreate}
            onValueChange={(v) => set("whoCanCreate")(v as "everyone" | "managers")}
            options={[
              { value: "everyone", label: "Everyone" },
              { value: "managers", label: "Only managers and admins" },
            ]}
          />
        </FormField>
        <FormField label="Auto-close after (days in Done)" htmlFor="g-close" span="md" description="Empty = never">
          <Input id="g-close" type="number" min={1} max={365} value={f.autoCloseDays} onChange={(e) => set("autoCloseDays")(e.target.value)} />
        </FormField>
        {toggle("assignAnyone", "Assign to anyone", "Off = only to yourself and your team")}
        {toggle("allowSelfAssign", "Assign to yourself", "People can raise tickets for themselves")}
        {toggle("requireProject", "Project is required", "Every ticket must pick a project")}
        {toggle("requireTimeOnDone", "Time log before Done", "A ticket can't be marked done without logged time")}
        {toggle("notifyOnAssign", "Notify on assign", "The assignee gets a notification")}
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <AuditInfo row={general} />
          <Button onClick={save} disabled={busy || !f.prefix}>
            {busy ? <Spinner /> : <Save />} Save settings
          </Button>
        </div>
      </FormGrid>
    </FormCard>
  );
}

export function TicketSettingsView() {
  const url = useUrlParams();
  const tab = url.get("tab", "projects");
  const reloadMeta = useTicketMeta((s) => s.load);
  const [data, setData] = useState<TicketSettingsData | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<{ list: SettingList; row: Row | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    reloadMeta();
    run(ticketsService.settings).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [version, reloadMeta]);

  const changed = () => {
    setEditing(null);
    setVersion((v) => v + 1);
    reloadMeta(true);
  };
  async function remove(list: SettingList, r: Row) {
    if ((await run(() => ticketsService.deleteSetting(list, r.id), { success: "Deleted" })).ok) changed();
  }

  if (!data) return <Skeleton className="h-96 rounded-xl" />;
  const rows = (l: SettingList) => data[l] as unknown as Row[];
  const common = (list: SettingList) => ({ list, rows: rows(list), onAdd: () => setEditing({ list, row: null }), onEdit: (row: Row) => setEditing({ list, row }), onDelete: (row: Row) => remove(list, row) });
  const count = (r: Row) => <span className="tabular-nums">{Number(r.tickets ?? 0)}</span>;
  const badge = (r: Row) => (
    <span className="flex items-center gap-1.5">
      <ColorBadge color={r.color as string} dot>
        {r.name}
      </ColorBadge>
      {Boolean(r.is_default) && <Star className="size-3.5 fill-warning text-warning" aria-label="Default" />}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => url.set({ tab: v === "projects" ? null : v })}>
        <TabsList className="mb-1 h-auto flex-wrap">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="priorities">Priorities</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        <TabsContent value="projects">
          <ListTab
            {...common("projects")}
            icon={FolderKanban}
            title="Projects"
            columns={[
              { label: "Project", cell: (r) => <span className="font-medium">{r.name}{r.code ? <span className="ml-1.5 font-mono text-2xs text-muted-foreground">{String(r.code)}</span> : null}</span> },
              { label: "Client", cell: (r) => String(r.client_name ?? "—") },
              { label: "Version", cell: (r) => String(r.version ?? "—") },
              { label: "Default assignee", cell: (r) => String(r.default_assignee_name ?? "—") },
              { label: "Modules", cell: (r) => <span className="tabular-nums">{Number(r.modules ?? 0)}</span>, className: "text-center" },
              { label: "Tickets", cell: count, className: "text-center" },
              { label: "Active", cell: (r) => <ActiveBadge on={Boolean(r.is_active)} /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="modules">
          <ListTab
            {...common("modules")}
            icon={Boxes}
            title="Modules"
            columns={[
              { label: "Project", cell: (r) => String(r.project_name ?? "") },
              { label: "Module", cell: (r) => <span className="font-medium">{r.name}</span> },
              { label: "Tickets", cell: count, className: "text-center" },
              { label: "Active", cell: (r) => <ActiveBadge on={Boolean(r.is_active)} /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="categories">
          <ListTab
            {...common("categories")}
            icon={Shapes}
            title="Categories"
            columns={[
              { label: "Category", cell: badge },
              { label: "Default days", cell: (r) => (r.default_days == null ? "—" : `${String(r.default_days)} days`), className: "text-center" },
              { label: "Order", cell: (r) => String(r.sort_order), className: "text-center" },
              { label: "Tickets", cell: count, className: "text-center" },
              { label: "Active", cell: (r) => <ActiveBadge on={Boolean(r.is_active)} /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="statuses">
          <ListTab
            {...common("statuses")}
            icon={CircleDot}
            title="Statuses"
            columns={[
              { label: "Status", cell: badge },
              { label: "Means", cell: (r) => KIND_LABEL[r.kind as StatusKind] },
              { label: "Order", cell: (r) => String(r.sort_order), className: "text-center" },
              { label: "Tickets", cell: count, className: "text-center" },
              { label: "Active", cell: (r) => <ActiveBadge on={Boolean(r.is_active)} /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="priorities">
          <ListTab
            {...common("priorities")}
            icon={Flag}
            title="Priorities"
            columns={[
              { label: "Priority", cell: badge },
              { label: "SLA", cell: (r) => (r.sla_hours == null ? "—" : `${String(r.sla_hours)} h`), className: "text-center" },
              { label: "Order", cell: (r) => String(r.sort_order), className: "text-center" },
              { label: "Tickets", cell: count, className: "text-center" },
              { label: "Active", cell: (r) => <ActiveBadge on={Boolean(r.is_active)} /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="general">
          <GeneralTab key={String(data.general.updated_at)} general={data.general} onSaved={changed} />
        </TabsContent>
      </Tabs>
      <SettingDialog list={editing?.list ?? null} row={editing?.row ?? null} data={data} onClose={() => setEditing(null)} onSaved={changed} />
    </div>
  );
}
