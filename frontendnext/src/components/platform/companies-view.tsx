"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CircleAlert, Search, ShieldCheck, Users } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { FormHeading } from "@/components/common/form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BUSINESS_TYPES } from "@/lib/company-rules";
import { fmtDate } from "@/lib/format";
import type { Id } from "@/lib/types";
import { usePlatformCompaniesStore } from "@/stores/platform-companies-store";
import { CompanyStatusBadge, VERIFICATION_OPTIONS, VerificationBadge } from "./company-badges";
import { CompanyDetailsSheet } from "./company-details-sheet";

const businessLabel = (v: string | null) => BUSINESS_TYPES.find((b) => b.value === v)?.label ?? "—";

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: typeof Building2; tone?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </div>
      <span className={`flex size-10 items-center justify-center rounded-lg ${tone ?? "bg-primary/10 text-primary"}`}>
        <Icon className="size-5" />
      </span>
    </div>
  );
}

// Super Admin: every company on the platform. Open one to review its details,
// verify or reject it, and suspend or reactivate it.
export function CompaniesView() {
  const list = usePlatformCompaniesStore((s) => s.list);
  const stats = usePlatformCompaniesStore((s) => s.stats);
  const loaded = usePlatformCompaniesStore((s) => s.loaded);
  const load = usePlatformCompaniesStore((s) => s.load);
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<Id | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (c) =>
        (!verification || c.verification_status === verification) &&
        (!status || c.status === status) &&
        (!q || [c.name, c.legal_name, c.city, ...c.owners.flatMap((o) => [o.name, o.email])].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [list, search, verification, status]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Companies" description="Every company on Workkind — review their details, verify them, and suspend or reactivate accounts." className="mb-0" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total companies" value={stats?.total ?? "—"} icon={Building2} />
        <Stat label="Active" value={stats?.active ?? "—"} icon={ShieldCheck} tone="bg-success/15 text-success" />
        <Stat label="Suspended" value={stats?.suspended ?? "—"} icon={CircleAlert} tone="bg-destructive/15 text-destructive" />
        <Stat label="Waiting for review" value={stats?.toReview ?? "—"} icon={Search} tone="bg-warning/15 text-warning" />
        <Stat label="Employees on platform" value={stats?.employees ?? "—"} icon={Users} />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading
          title={`All companies · ${visible.length}${visible.length !== list.length ? ` of ${list.length}` : ""}`}
          actions={
            <>
              <Input placeholder="Search name, city, owner…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-56" aria-label="Search companies" />
              <SelectField size="sm" className="w-36" value={verification} onValueChange={setVerification} emptyLabel="All verification" options={VERIFICATION_OPTIONS} aria-label="Filter by verification" />
              <SelectField
                size="sm"
                className="w-32"
                value={status}
                onValueChange={setStatus}
                emptyLabel="All statuses"
                options={[
                  { value: "active", label: "Active" },
                  { value: "suspended", label: "Suspended" },
                ]}
                aria-label="Filter by status"
              />
            </>
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaded && visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  {list.length ? "No companies match these filters." : "No companies yet — invite an admin from the Admins page."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <CompanyLogo name={c.name} logoUrl={c.logo_url} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        {c.legal_name && <span className="block truncate text-xs text-muted-foreground">{c.legal_name}</span>}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {c.owners[0] ? (
                      <span className="block min-w-0">
                        <span className="block truncate">{c.owners[0].name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.owners[0].email}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{businessLabel(c.business_type)}</TableCell>
                  <TableCell>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.employee_count}</TableCell>
                  <TableCell className="capitalize">
                    {c.subscription_status ?? "—"}
                    {c.subscription_status === "trial" && c.trial_ends_at && <span className="block text-xs text-muted-foreground normal-case">until {fmtDate(c.trial_ends_at)}</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{fmtDate(c.created_at)}</TableCell>
                  <TableCell>
                    <VerificationBadge status={c.verification_status} />
                  </TableCell>
                  <TableCell>
                    <CompanyStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => (e.stopPropagation(), setOpenId(c.id))}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <CompanyDetailsSheet companyId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
