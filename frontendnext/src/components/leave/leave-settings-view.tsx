"use client";

// Leave Settings: the company's own leave types (quota, carry forward, paid / unpaid, who can take it…)
// and leave rules (leave year, sandwich rule, backdated leave, short balance, comp off)
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCog, Lock, Pencil, Plus, Save, Scale, Tags } from "lucide-react";
import { AuditCell, AuditInfo } from "@/components/common/audit-info";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { ColorPicker } from "@/components/tickets/ticket-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlParams } from "@/hooks/use-url-params";
import { api } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import { useLeaveTypesStore } from "@/stores/leave-types-store";

interface LeaveTypeRow {
  id: number;
  code: string;
  name: string;
  short_name: string;
  color: string;
  kind: "quota" | "comp_off" | "unpaid";
  is_paid: boolean;
  quota: string;
  quota_period: "year" | "month" | "none";
  carry_forward: "none" | "all" | "max";
  carry_max: string | null;
  allow_half_day: boolean;
  gender: "all" | "female" | "male";
  after_probation: boolean;
  min_notice_days: number | null;
  max_days_per_request: string | null;
  document_after_days: string | null;
  optional_holidays_only: boolean;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  requests: number;
  created_at: string | null;
  created_by_name: string | null;
  updated_at: string | null;
  updated_by: number | null;
  updated_by_name: string | null;
}
interface LeaveRules {
  sandwich_rule: boolean;
  backdated_days: number | null;
  when_short: "block" | "unpaid";
  comp_off_valid_days: number;
  comp_off_full_minutes: number;
  comp_off_half_minutes: number;
  leave_year: "calendar" | "financial";
  created_at: string | null;
  created_by_name: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
}
interface Data {
  types: LeaveTypeRow[];
  rules: LeaveRules;
}

const service = {
  get: async () => (await api.get<Data>("/leaves/settings")).data,
  saveType: async (id: number | null, body: Record<string, unknown>) => (id ? await api.put(`/leaves/settings/types/${id}`, body) : await api.post("/leaves/settings/types", body)).data,
  deleteType: async (id: number) => {
    await api.delete(`/leaves/settings/types/${id}`);
  },
  saveRules: async (body: Record<string, unknown>) => (await api.put<Data>("/leaves/settings/rules", body)).data,
};

const KIND: Record<LeaveTypeRow["kind"], string> = { quota: "Balance", comp_off: "Comp off (earned)", unpaid: "Unpaid (LOP)" };
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: string) => (v === "" ? null : Number(v));
const hours = (m: number) => (m ? String(Math.round((m / 60) * 100) / 100) : "");

type TypeForm = Record<string, string | boolean>;
function toTypeForm(t: LeaveTypeRow | null): TypeForm {
  return {
    code: s(t?.code),
    name: s(t?.name),
    shortName: s(t?.short_name),
    color: t?.color ?? "#2563eb",
    kind: t?.kind ?? "quota",
    isPaid: t ? t.is_paid : true,
    quota: t ? String(Number(t.quota)) : "0",
    quotaPeriod: t?.quota_period ?? "year",
    carryForward: t?.carry_forward ?? "none",
    carryMax: t?.carry_max == null ? "" : String(Number(t.carry_max)),
    allowHalfDay: t ? t.allow_half_day : true,
    gender: t?.gender ?? "all",
    afterProbation: Boolean(t?.after_probation),
    minNoticeDays: s(t?.min_notice_days),
    maxDaysPerRequest: t?.max_days_per_request == null ? "" : String(Number(t.max_days_per_request)),
    documentAfterDays: t?.document_after_days == null ? "" : String(Number(t.document_after_days)),
    optionalHolidaysOnly: Boolean(t?.optional_holidays_only),
    isActive: t ? t.is_active : true,
    sortOrder: s(t?.sort_order ?? 0),
  };
}

function TypeDialog({ row, open, onClose, onSaved }: { row: LeaveTypeRow | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<TypeForm>(() => toTypeForm(row));
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const str = (k: string) => String(f[k] ?? "");
  const locked = Boolean(row?.is_system);
  const quotaKind = f.kind === "quota";

  async function save() {
    setBusy(true);
    const r = await run(
      () =>
        service.saveType(row?.id ?? null, {
          ...f,
          code: str("code").toLowerCase(),
          quota: Number(str("quota") || 0),
          carryMax: n(str("carryMax")),
          minNoticeDays: n(str("minNoticeDays")),
          maxDaysPerRequest: n(str("maxDaysPerRequest")),
          documentAfterDays: n(str("documentAfterDays")),
          sortOrder: Number(str("sortOrder") || 0),
        }),
      { success: row ? "Leave type saved" : "Leave type added" },
    );
    setBusy(false);
    if (r.ok) onSaved();
  }
  const toggle = (k: string, label: string, hint: string, disabled = false) => (
    <label className="col-span-12 flex items-start gap-2 rounded-lg border p-2.5 text-sm md:col-span-6">
      <Switch checked={Boolean(f[k])} onCheckedChange={set(k)} disabled={disabled} className="mt-0.5" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.name}` : "New leave type"}</DialogTitle>
          <DialogDescription>{locked ? "A built-in type: its code and kind stay the same so older requests keep working." : "Your own leave type, e.g. Maternity, Paternity, Bereavement."}</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FieldSeparator label="Basics" />
          <FormField label="Name" htmlFor="lt-name" required span="md">
            <Input id="lt-name" value={str("name")} onChange={(e) => set("name")(e.target.value)} maxLength={60} autoFocus />
          </FormField>
          <FormField label="Short name" htmlFor="lt-short" required>
            <Input id="lt-short" value={str("shortName")} onChange={(e) => set("shortName")(e.target.value)} maxLength={12} />
          </FormField>
          <FormField label="Code" htmlFor="lt-code" required description="Small letters, e.g. ml">
            <Input id="lt-code" value={str("code")} onChange={(e) => set("code")(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={20} disabled={locked} />
          </FormField>
          <FormField label="What it is" htmlFor="lt-kind">
            <SelectField
              id="lt-kind"
              value={str("kind")}
              onValueChange={set("kind")}
              disabled={locked}
              options={[
                { value: "quota", label: "Balance (quota)" },
                { value: "comp_off", label: "Comp off (earned)" },
                { value: "unpaid", label: "Unpaid (LOP)" },
              ]}
            />
          </FormField>
          <FormField label="Order" htmlFor="lt-order">
            <Input id="lt-order" type="number" min={0} max={999} value={str("sortOrder")} onChange={(e) => set("sortOrder")(e.target.value)} />
          </FormField>
          <FormField label="Colour" float={false} span="lg">
            <ColorPicker value={str("color")} onChange={set("color")} />
          </FormField>

          {quotaKind && (
            <>
              <FieldSeparator label="Quota" />
              <FormField label="Quota period" htmlFor="lt-period">
                <SelectField
                  id="lt-period"
                  value={str("quotaPeriod")}
                  onValueChange={set("quotaPeriod")}
                  options={[
                    { value: "year", label: "Per leave year" },
                    { value: "month", label: "Per month" },
                    { value: "none", label: "No limit" },
                  ]}
                />
              </FormField>
              {f.quotaPeriod !== "none" && (
                <FormField label={f.quotaPeriod === "month" ? "Days a month" : "Days a year"} htmlFor="lt-quota">
                  <Input id="lt-quota" type="number" min={0} max={365} step={0.5} value={str("quota")} onChange={(e) => set("quota")(e.target.value)} />
                </FormField>
              )}
              {f.quotaPeriod === "year" && (
                <>
                  <FormField label="Unused days at year end" htmlFor="lt-carry">
                    <SelectField
                      id="lt-carry"
                      value={str("carryForward")}
                      onValueChange={set("carryForward")}
                      options={[
                        { value: "none", label: "Lapse" },
                        { value: "all", label: "Carry forward all" },
                        { value: "max", label: "Carry forward up to…" },
                      ]}
                    />
                  </FormField>
                  {f.carryForward === "max" && (
                    <FormField label="Most days carried" htmlFor="lt-carrymax">
                      <Input id="lt-carrymax" type="number" min={0} max={365} step={0.5} value={str("carryMax")} onChange={(e) => set("carryMax")(e.target.value)} />
                    </FormField>
                  )}
                </>
              )}
              {toggle("isPaid", "Paid leave", "Off = counted as loss of pay in payroll")}
            </>
          )}

          <FieldSeparator label="Rules" />
          <FormField label="Who can take it" htmlFor="lt-gender">
            <SelectField
              id="lt-gender"
              value={str("gender")}
              onValueChange={set("gender")}
              options={[
                { value: "all", label: "Everyone" },
                { value: "female", label: "Women only" },
                { value: "male", label: "Men only" },
              ]}
            />
          </FormField>
          <FormField label="Notice (days before)" htmlFor="lt-notice" description="Empty = none">
            <Input id="lt-notice" type="number" min={0} max={365} value={str("minNoticeDays")} onChange={(e) => set("minNoticeDays")(e.target.value)} />
          </FormField>
          <FormField label="Most days at a time" htmlFor="lt-max" description="Empty = no limit">
            <Input id="lt-max" type="number" min={0} max={365} step={0.5} value={str("maxDaysPerRequest")} onChange={(e) => set("maxDaysPerRequest")(e.target.value)} />
          </FormField>
          <FormField label="Document after (days)" htmlFor="lt-doc" description="e.g. 2 = certificate for 3+ days">
            <Input id="lt-doc" type="number" min={0} max={365} step={0.5} value={str("documentAfterDays")} onChange={(e) => set("documentAfterDays")(e.target.value)} />
          </FormField>
          {toggle("allowHalfDay", "Half day allowed", "People can take half of a day")}
          {toggle("afterProbation", "Only after probation", "Not available while on probation")}
          {quotaKind && toggle("optionalHolidaysOnly", "Only on optional holidays", "Like OL: only on the company's optional holidays")}
          {toggle("isActive", "Active", "Inactive types can't be applied for (old requests stay)")}
        </FormGrid>
        {row && <AuditInfo row={row} className="border-t pt-3" />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !str("name").trim() || !str("shortName").trim() || !str("code")}>
            {busy ? <Spinner /> : <Save />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypesTab({ types, onChanged }: { types: LeaveTypeRow[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<{ row: LeaveTypeRow | null } | null>(null);
  const describe = (t: LeaveTypeRow) => {
    if (t.kind === "comp_off") return "Earned by working an off day";
    if (t.kind === "unpaid") return "No limit · loss of pay";
    if (t.quota_period === "none") return "No limit";
    const q = `${Number(t.quota)} / ${t.quota_period === "month" ? "month" : "year"}`;
    const carry = t.carry_forward === "all" ? " · carries forward" : t.carry_forward === "max" ? ` · carries up to ${Number(t.carry_max)}` : "";
    return q + carry;
  };
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <FormHeading
        title={`Leave types · ${types.length}`}
        icon={Tags}
        actions={
          <Button size="sm" onClick={() => setEditing({ row: null })}>
            <Plus /> Add leave type
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <Table className="border-collapse [&_td]:border [&_th]:border">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Leave type</TableHead>
              <TableHead>Quota</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead className="text-center">Requests</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Updated By</TableHead>
              <TableHead className="w-20 text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t, i) => (
              <TableRow key={t.id} className={t.is_active ? undefined : "opacity-60"}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-medium">{t.name}</span>
                    <span className="font-mono text-2xs text-muted-foreground">{t.short_name}</span>
                    {t.is_system && <Lock className="size-3 text-muted-foreground" aria-label="Built-in" />}
                  </div>
                  <div className="text-2xs text-muted-foreground">{KIND[t.kind]}</div>
                </TableCell>
                <TableCell className="text-xs">{describe(t)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[
                    !t.is_paid && "Unpaid",
                    !t.allow_half_day && "No half day",
                    t.gender !== "all" && (t.gender === "female" ? "Women only" : "Men only"),
                    t.after_probation && "After probation",
                    t.min_notice_days ? `${t.min_notice_days}d notice` : null,
                    t.max_days_per_request ? `max ${Number(t.max_days_per_request)}d` : null,
                    t.document_after_days != null ? `doc after ${Number(t.document_after_days)}d` : null,
                    t.optional_holidays_only && "Optional holidays",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-center tabular-nums">{t.requests}</TableCell>
                <TableCell>{t.is_active ? <Badge variant="outline" className="border-success/40 text-success">Active</Badge> : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}</TableCell>
                <TableCell>
                  <AuditCell name={t.created_by_name} at={t.created_by_name ? t.created_at : null} />
                </TableCell>
                <TableCell>
                  <AuditCell name={t.updated_by_name} at={t.updated_by ? t.updated_at : null} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={() => setEditing({ row: t })}>
                      <Pencil />
                    </Button>
                    {!t.is_system && (
                      <ConfirmDelete
                        title={`Delete ${t.name}?`}
                        description={t.requests > 0 ? "It has leave requests, so it can't be deleted — make it inactive instead." : "This can't be undone."}
                        onConfirm={async () => (await run(() => service.deleteType(t.id), { success: "Deleted" })).ok && onChanged()}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <TypeDialog
          key={editing.row?.id ?? "new"}
          row={editing.row}
          open
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function RulesTab({ rules, onSaved }: { rules: LeaveRules; onSaved: (d: Data) => void }) {
  const [f, setF] = useState(() => ({
    leaveYear: rules.leave_year,
    sandwichRule: rules.sandwich_rule,
    backdatedDays: s(rules.backdated_days),
    whenShort: rules.when_short,
    compOffValidDays: String(rules.comp_off_valid_days),
    compOffFullHours: hours(rules.comp_off_full_minutes),
    compOffHalfHours: hours(rules.comp_off_half_minutes),
  }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const mins = (h: string) => Math.round(Number(h || 0) * 60);

  async function save() {
    setBusy(true);
    const r = await run(
      () =>
        service.saveRules({
          leaveYear: f.leaveYear,
          sandwichRule: f.sandwichRule,
          backdatedDays: n(f.backdatedDays),
          whenShort: f.whenShort,
          compOffValidDays: Number(f.compOffValidDays || 90),
          compOffFullMinutes: mins(f.compOffFullHours),
          compOffHalfMinutes: mins(f.compOffHalfHours),
        }),
      { success: "Leave rules saved" },
    );
    setBusy(false);
    if (r.ok) onSaved(r.data);
  }

  return (
    <FormCard title="Leave rules" icon={Scale}>
      <FormGrid>
        <FieldSeparator label="Leave year" />
        <FormField label="Leave year" htmlFor="lr-year" span="md">
          <SelectField
            id="lr-year"
            value={f.leaveYear}
            onValueChange={(v) => set("leaveYear")(v as "calendar" | "financial")}
            options={[
              { value: "financial", label: "Financial year (Apr – Mar)" },
              { value: "calendar", label: "Calendar year (Jan – Dec)" },
            ]}
          />
        </FormField>
        <FieldSeparator label="Applying" />
        <label className="col-span-12 flex items-start gap-2 rounded-lg border p-2.5 text-sm md:col-span-6">
          <Switch checked={f.sandwichRule} onCheckedChange={set("sandwichRule")} className="mt-0.5" />
          <span>
            <span className="font-medium">Sandwich rule</span>
            <span className="block text-xs text-muted-foreground">Weekly offs / holidays between leave days count as leave (e.g. Fri + Mon leave = 4 days)</span>
          </span>
        </label>
        <FormField label="Apply for past days up to (days)" htmlFor="lr-back" description="Empty = any; 0 = no past days">
          <Input id="lr-back" type="number" min={0} max={365} value={f.backdatedDays} onChange={(e) => set("backdatedDays")(e.target.value)} />
        </FormField>
        <FormField label="When the balance runs out" htmlFor="lr-short" span="md">
          <SelectField
            id="lr-short"
            value={f.whenShort}
            onValueChange={(v) => set("whenShort")(v as "block" | "unpaid")}
            options={[
              { value: "block", label: "Don't allow the request" },
              { value: "unpaid", label: "Allow it as unpaid leave (LOP)" },
            ]}
          />
        </FormField>
        <FieldSeparator label="Comp off" />
        <FormField label="Valid for (days)" htmlFor="lr-valid">
          <Input id="lr-valid" type="number" min={1} max={365} value={f.compOffValidDays} onChange={(e) => set("compOffValidDays")(e.target.value)} />
        </FormField>
        <FormField label="Full day if worked (hours)" htmlFor="lr-full" description="Empty = any check-in">
          <Input id="lr-full" type="number" min={0} max={24} step={0.25} value={f.compOffFullHours} onChange={(e) => set("compOffFullHours")(e.target.value)} />
        </FormField>
        <FormField label="Half day if worked (hours)" htmlFor="lr-half" description="Empty = no half comp off">
          <Input id="lr-half" type="number" min={0} max={24} step={0.25} value={f.compOffHalfHours} onChange={(e) => set("compOffHalfHours")(e.target.value)} />
        </FormField>
        <p className="col-span-12 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Working a weekly off or holiday earns comp off. Weekly offs are set in{" "}
          <Link href="/attendance/settings?tab=weekoff" className="font-medium text-primary hover:underline">
            Attendance Settings
          </Link>
          , holidays in{" "}
          <Link href="/holidays" className="font-medium text-primary hover:underline">
            Holidays
          </Link>
          .
        </p>
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <AuditInfo row={rules} />
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <Save />} Save rules
          </Button>
        </div>
      </FormGrid>
    </FormCard>
  );
}

export function LeaveSettingsView() {
  const url = useUrlParams();
  const tab = url.get("tab", "types");
  const reloadTypes = useLeaveTypesStore((x) => x.load);
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    run(service.get).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (!data) return <Skeleton className="h-96 rounded-xl" />;
  const changed = () => {
    setVersion((v) => v + 1);
    reloadTypes(true);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => url.set({ tab: v === "types" ? null : v })} className="gap-3">
      <TabsList>
        <TabsTrigger value="types">
          <Tags /> Leave types
        </TabsTrigger>
        <TabsTrigger value="rules">
          <CalendarCog /> Rules
        </TabsTrigger>
      </TabsList>
      <TabsContent value="types">
        <TypesTab types={data.types} onChanged={changed} />
      </TabsContent>
      <TabsContent value="rules">
        <RulesTab key={String(data.rules.updated_at)} rules={data.rules} onSaved={(d) => setData(d)} />
      </TabsContent>
    </Tabs>
  );
}
