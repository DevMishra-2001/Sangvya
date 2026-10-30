"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/client";
import { EMPLOYMENT_TYPE_LABELS, EXIT_REASON_LABELS } from "@/lib/constants";
import { fmtDate, inr } from "@/lib/format";
import { employeesService } from "@/lib/services/employees";
import type { Employee } from "@/lib/types";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { EmployeeDocuments } from "./employee-documents";
import { EmployeeExitPanel } from "./employee-exit-panel";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { EmployeeStatusBadge } from "./employee-status-badge";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{title}</h3>
      <dl className="divide-y px-4">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{value || "—"}</dd>
    </div>
  );
}

// One employee: overview, documents and their exit (HR / Admin)
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
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const manager = list.find((m) => m.id === e.manager_id);
  const reports = list.filter((m) => m.manager_id === e.id && m.status !== "exited");
  const isMe = e.id === me?.employee_id;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/employees" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All employees
      </Link>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center">
        <PersonAvatar name={e.name} photoUrl={e.photo_url} className="size-16 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{e.name}</h1>
            <EmployeeStatusBadge employee={e} />
            {e.role && <Badge variant="outline">{e.role}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {[e.designation, e.department, EMPLOYMENT_TYPE_LABELS[e.employment_type]].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[e.employee_code, e.email, e.join_date && `Joined ${fmtDate(e.join_date)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
        )}
      </section>

      {e.status === "notice" && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          Serving notice — last working day <strong>{fmtDate(e.exit_date)}</strong>
          {e.exit_reason && ` (${EXIT_REASON_LABELS[e.exit_reason]})`}.
        </p>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canManage && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {canManage && <TabsTrigger value="exit">{e.status === "active" ? "Exit" : e.status === "notice" ? "Exit · notice" : "Exit · left"}</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Section title="Job">
            <Row label="Employee code" value={e.employee_code} />
            <Row label="Designation" value={e.designation} />
            <Row label="Department" value={e.department} />
            <Row label="Role (access)" value={e.role} />
            <Row label="Employment type" value={EMPLOYMENT_TYPE_LABELS[e.employment_type]} />
            <Row label="Shift" value={e.shift ?? "Company default"} />
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
            <Row label="Joined" value={e.join_date && `${fmtDate(e.join_date)} · ${tenure(e.join_date, e.status === "exited" ? e.exit_date : null) ?? ""}`} />
            {e.status !== "active" && <Row label="Last working day" value={fmtDate(e.exit_date)} />}
          </Section>

          <Section title="Contact & personal">
            <Row label="Email" value={e.email} />
            <Row label="Phone" value={e.phone} />
            <Row label="Gender" value={e.gender && e.gender[0].toUpperCase() + e.gender.slice(1)} />
            <Row label="Date of birth" value={fmtDate(e.date_of_birth)} />
            <Row label="Address" value={e.address} />
            <Row label="Emergency contact" value={[e.emergency_contact_name, e.emergency_contact_phone].filter(Boolean).join(" · ")} />
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
          <TabsContent value="exit" className="mt-4">
            <EmployeeExitPanel key={`${e.id}-${e.status}-${e.exit_date}`} employee={e} isMe={isMe} teamSize={reports.length} onChange={upsert} />
          </TabsContent>
        )}
      </Tabs>

      {canManage && <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={e} />}
    </div>
  );
}
