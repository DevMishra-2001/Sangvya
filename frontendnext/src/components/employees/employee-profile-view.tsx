"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, Building2, Clock, Eye, EyeOff, Link2, Mail, MapPin, Pencil, Phone, ShieldCheck, UserRound } from "lucide-react";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import { ACCOUNT_TYPE_LABELS, EMPLOYMENT_TYPE_LABELS, EXIT_REASON_LABELS, GENDER_LABELS, MARITAL_STATUS_LABELS, RELATION_LABELS, WORK_MODE_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import type { Employee, EmployeePrivate } from "@/lib/types";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { EmployeeDocuments } from "./employee-documents";
import { EmployeeExitPanel } from "./employee-exit-panel";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { OnboardingLinkDialog } from "./onboarding-link-dialog";

// "3 yrs 2 mos" since joining (up to the exit day for people who left)
function tenure(from: string | null, to?: string | null) {
  if (!from) return null;
  const a = new Date(`${from}T00:00:00`);
  const b = to ? new Date(`${to}T00:00:00`) : new Date();
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y && !m) return "Less than a month";
  return [y && `${y} yr${y === 1 ? "" : "s"}`, m && `${m} mo${m === 1 ? "" : "s"}`].filter(Boolean).join(" ");
}

const label = <T extends string>(labels: Record<T, string>, v: string | null | undefined) => (v ? (labels[v as T] ?? v) : null);
// "XXXX XXXX 9012"
const mask = (v: string | null, show = 4) => (v ? `${"•".repeat(Math.max(0, v.length - show))}${v.slice(-show)}` : null);

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <h3 className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
        {Icon && <Icon className="size-4 text-primary" />}
        {title}
      </h3>
      <dl className="divide-y px-4">{children}</dl>
    </section>
  );
}

function Row({ label: name, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{name}</dt>
      <dd className="min-w-0 text-right break-words">{value || "—"}</dd>
    </div>
  );
}

function Stat({ icon: Icon, value, caption }: { icon: React.ElementType; value: React.ReactNode; caption: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{value || "—"}</span>
        <span className="block text-xs text-muted-foreground">{caption}</span>
      </span>
    </div>
  );
}

// Bank + statutory IDs, masked until "Show" (HR / Admin)
function BankTab({ employeeId }: { employeeId: number }) {
  const [data, setData] = useState<EmployeePrivate | null | undefined>(undefined);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    run(() => employeesService.private(employeeId)).then((r) => !cancelled && setData(r.ok ? r.data : null));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (data === undefined) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }
  const v = (x: string | null) => (show ? x : mask(x));
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setShow((s) => !s)}>
        {show ? <EyeOff /> : <Eye />} {show ? "Hide numbers" : "Show full numbers"}
      </Button>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Bank account" icon={Building2}>
          <Row label="Account holder" value={data?.account_holder} />
          <Row label="Account number" value={v(data?.account_number ?? null)} />
          <Row label="IFSC" value={data?.ifsc} />
          <Row label="Bank" value={data?.bank_name} />
          <Row label="Branch" value={data?.bank_branch} />
          <Row label="Account type" value={label(ACCOUNT_TYPE_LABELS, data?.account_type)} />
        </Section>
        <Section title="Statutory (India)" icon={ShieldCheck}>
          <Row label="PAN" value={v(data?.pan ?? null)} />
          <Row label="Aadhaar" value={v(data?.aadhaar ?? null)} />
          <Row label="UAN" value={data?.uan} />
          <Row label="PF number" value={data?.pf_number} />
          <Row label="ESI number" value={data?.esi_number} />
          <Row label="Passport" value={v(data?.passport_number ?? null)} />
        </Section>
      </div>
    </div>
  );
}

function TimelineTab({ employeeId }: { employeeId: number }) {
  const [events, setEvents] = useState<Awaited<ReturnType<typeof employeesService.timeline>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    run(() => employeesService.timeline(employeeId)).then((r) => !cancelled && setEvents(r.ok ? r.data : []));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (!events) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }
  if (!events.length) return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>;
  return (
    <ol className="rounded-xl border bg-card p-4">
      {events.map((ev) => (
        <li key={ev.id} className="relative border-l pb-4 pl-5 last:pb-0">
          <span className="absolute top-1 -left-1.5 size-3 rounded-full border-2 border-card bg-primary" />
          <p className="text-sm">{ev.summary}</p>
          <p className="text-xs text-muted-foreground">
            {fmtDateTime(ev.created_at)}
            {ev.actor && ` · by ${ev.actor}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

// One employee: header, quick facts and tabs (HR / Admin see everything)
export function EmployeeProfileView({ id }: { id: number }) {
  const can = useCan();
  const canManage = can("employees.manage");
  const canSeePay = canManage || can("payroll.view");
  const me = useAuthStore((s) => s.user);
  const list = useEmployeesStore((s) => s.list);
  const loadList = useEmployeesStore((s) => s.load);
  const upsert = useEmployeesStore((s) => s.upsert);
  const [loaded, setLoaded] = useState<{ id: number; employee?: Employee; error?: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    employeesService
      .get(id)
      .then((employee) => {
        if (cancelled) return;
        setLoaded({ id, employee });
        upsert(employee);
      })
      .catch((err) => !cancelled && setLoaded({ id, error: errorMessage(err) }));
    if (!list.length) loadList();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per employee
  }, [id]);

  // The list copy is updated by the edit dialog, so prefer it once it's there
  const e = list.find((x) => x.id === id) ?? (loaded?.id === id ? loaded.employee : undefined);
  if (loaded?.id === id && loaded.error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">{loaded.error}</p>
        <Button variant="outline" asChild>
          <Link href="/employees">
            <ArrowLeft /> All employees
          </Link>
        </Button>
      </div>
    );
  }
  if (!e) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const manager = list.find((m) => m.id === e.manager_id);
  const reports = list.filter((m) => m.manager_id === e.id && m.status !== "exited");
  const isMe = e.id === me?.employee_id;
  const addressLines = [e.address, e.address_line2].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/employees" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All employees
      </Link>

      <section className="flex flex-col gap-4 overflow-hidden rounded-xl border border-t-4 border-t-primary bg-card p-5 sm:flex-row sm:items-start">
        <PersonAvatar name={e.name} photoUrl={e.photo_url} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{e.name}</h1>
            <EmployeeStatusBadge employee={e} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{e.designation || "No designation"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {e.department && <Badge variant="outline">{e.department}</Badge>}
            {e.branch && (
              <Badge variant="outline">
                <MapPin /> {e.branch}
              </Badge>
            )}
            {e.work_mode && <Badge variant="secondary">{WORK_MODE_LABELS[e.work_mode]}</Badge>}
            {e.employee_code && <Badge variant="secondary">{e.employee_code}</Badge>}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {e.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" /> {e.email}
              </span>
            )}
            {e.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3.5" /> {e.phone}
              </span>
            )}
            {e.join_date && <span>Joined {fmtDate(e.join_date)}</span>}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLinkOpen(true)}>
              <Link2 /> Onboarding link
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Clock} value={tenure(e.join_date, e.status === "exited" ? e.exit_date : null)} caption="Tenure" />
        <Stat icon={Briefcase} value={e.department} caption="Department" />
        <Stat icon={UserRound} value={manager && <Link href={`/employees/${manager.id}`} className="hover:text-primary hover:underline">{manager.name}</Link>} caption="Reports to" />
        <Stat icon={ShieldCheck} value={e.role} caption="Role" />
      </div>

      {e.status === "notice" && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          Serving notice — last working day <strong>{fmtDate(e.exit_date)}</strong>
          {e.exit_reason && ` (${EXIT_REASON_LABELS[e.exit_reason]})`}.
        </p>
      )}

      <Tabs defaultValue="about">
        <TabsList className="flex-wrap">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="work">Work</TabsTrigger>
          {canManage && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {canManage && <TabsTrigger value="bank">Bank & IDs</TabsTrigger>}
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          {canManage && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
          {canManage && <TabsTrigger value="exit">{e.status === "active" ? "Exit" : e.status === "notice" ? "Exit · notice" : "Exit · left"}</TabsTrigger>}
        </TabsList>

        <TabsContent value="about" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Section title="Personal information" icon={UserRound}>
            <Row label="Full name" value={e.name} />
            <Row label="Date of birth" value={e.date_of_birth && fmtDate(e.date_of_birth)} />
            <Row label="Gender" value={label(GENDER_LABELS, e.gender)} />
            <Row label="Marital status" value={label(MARITAL_STATUS_LABELS, e.marital_status)} />
            <Row label="Blood group" value={e.blood_group} />
            <Row label="Nationality" value={e.nationality} />
          </Section>
          <Section title="Contact & address" icon={MapPin}>
            <Row label="Work email" value={e.email} />
            <Row label="Personal email" value={e.personal_email} />
            <Row label="Phone" value={e.phone} />
            <Row label="Address" value={addressLines} />
            <Row label="City" value={e.city} />
            <Row label="State" value={e.state} />
            <Row label="Pincode" value={e.postal_code} />
            <Row label="Country" value={e.country} />
          </Section>
        </TabsContent>

        <TabsContent value="work" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Section title="Job" icon={Briefcase}>
            <Row label="Employee code" value={e.employee_code} />
            <Row label="Designation" value={e.designation} />
            <Row label="Department" value={e.department} />
            <Row label="Branch / location" value={e.branch} />
            <Row label="Business unit" value={e.business_unit} />
            <Row label="Work mode" value={label(WORK_MODE_LABELS, e.work_mode)} />
            <Row label="Employment type" value={EMPLOYMENT_TYPE_LABELS[e.employment_type]} />
            <Row label="Role (access)" value={e.role} />
            <Row label="Shift" value={e.shift ?? "Company default"} />
          </Section>
          <Section title="Dates & team" icon={Clock}>
            <Row label="Joined" value={e.join_date && `${fmtDate(e.join_date)} · ${tenure(e.join_date, e.status === "exited" ? e.exit_date : null) ?? ""}`} />
            <Row label="Probation ends" value={e.probation_end_date && fmtDate(e.probation_end_date)} />
            {e.status !== "active" && <Row label="Last working day" value={fmtDate(e.exit_date)} />}
            <Row label="Reports to" value={manager && <Link href={`/employees/${manager.id}`} className="text-primary hover:underline">{manager.name}</Link>} />
            <Row
              label="Team"
              value={
                reports.length
                  ? reports.map((r, i) => (
                      <span key={r.id}>
                        {i > 0 && ", "}
                        <Link href={`/employees/${r.id}`} className="text-primary hover:underline">
                          {r.name}
                        </Link>
                      </span>
                    ))
                  : null
              }
            />
            <Row label="Login" value={e.has_login ? (e.login_blocked ? "Blocked" : "Can log in") : "No login"} />
          </Section>
          {canSeePay && (
            <Section title="Pay & leave">
              <Row label="Monthly salary" value={e.salary ? inr(e.salary) : null} />
              <Row label="Optional leaves per year" value={e.ol_quota ?? "Company default"} />
            </Section>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="documents" className="mt-4">
            <EmployeeDocuments employeeId={e.id} />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="bank" className="mt-4">
            <BankTab employeeId={e.id} />
          </TabsContent>
        )}

        <TabsContent value="emergency" className="mt-4 max-w-2xl">
          <Section title="Emergency contact" icon={Phone}>
            <Row label="Name" value={e.emergency_contact_name} />
            <Row label="Relationship" value={label(RELATION_LABELS, e.emergency_contact_relation)} />
            <Row label="Phone" value={e.emergency_contact_phone} />
          </Section>
        </TabsContent>

        {canManage && (
          <TabsContent value="timeline" className="mt-4 max-w-3xl">
            <TimelineTab employeeId={e.id} />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="exit" className="mt-4">
            <EmployeeExitPanel key={`${e.id}-${e.status}-${e.exit_date}`} employee={e} isMe={isMe} teamSize={reports.length} onChange={upsert} />
          </TabsContent>
        )}
      </Tabs>

      {canManage && <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={e} />}
      {canManage && <OnboardingLinkDialog open={linkOpen} onOpenChange={setLinkOpen} employee={e} />}
    </div>
  );
}
