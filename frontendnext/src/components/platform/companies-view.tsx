"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Building2, CircleAlert, CreditCard, Hourglass, Moon, Search, Wallet } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { FormHeading } from "@/components/common/form-layout";
import { StatTile } from "@/components/common/stat-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, inr, timeAgo } from "@/lib/format";
import type { Id, PlatformCompany } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlatformCompaniesStore } from "@/stores/platform-companies-store";
import { CompanyStatusBadge, VERIFICATION_OPTIONS, VerificationBadge } from "./company-badges";
import { CompanyDetailsSheet } from "./company-details-sheet";

const DAY = 86400000;
const inactive = (c: PlatformCompany) => !c.last_active_at || Date.now() - new Date(c.last_active_at).getTime() > 14 * DAY;
const trialLeft = (c: PlatformCompany) => (c.trial_ends_at ? Math.ceil((new Date(c.trial_ends_at).getTime() - Date.now()) / DAY) : null);

// Quick views (the tiles above the table)
const SEGMENTS: Record<string, { label: string; match: (c: PlatformCompany) => boolean }> = {
  all: { label: "All companies", match: () => true },
  trialEnding: { label: "Trial ending (7 days)", match: (c) => c.subscription_status === "trial" && (trialLeft(c) ?? 99) <= 7 },
  trial: { label: "On trial", match: (c) => c.subscription_status === "trial" },
  paid: { label: "Paying", match: (c) => c.subscription_status === "active" },
  pastDue: { label: "Payment due", match: (c) => c.subscription_status === "past_due" },
  inactive: { label: "Inactive 14+ days", match: inactive },
  toReview: { label: "To review", match: (c) => c.verification_status === "unverified" || c.verification_status === "pending" },
  suspended: { label: "Suspended", match: (c) => c.status === "suspended" },
};

function Plan({ c }: { c: PlatformCompany }) {
  const left = trialLeft(c);
  if (c.subscription_status === "trial") {
    return (
      <span className={cn("text-sm", left != null && left <= 3 && "text-destructive")}>
        Trial · {left == null ? "—" : left <= 0 ? "ended" : `${left} day${left === 1 ? "" : "s"} left`}
      </span>
    );
  }
  if (c.subscription_status === "active") {
    return (
      <span className="text-sm">
        Paying · {inr(Number(c.price_per_employee ?? 0) * (c.seats ?? 0))}/mo
        <span className="block text-xs text-muted-foreground">
          {c.seats} × {inr(Number(c.price_per_employee ?? 0))}
        </span>
      </span>
    );
  }
  return <span className="text-sm capitalize">{c.subscription_status?.replace("_", " ") ?? "—"}</span>;
}

// Super Admin: every company, how healthy it is, and quick ways to act on it
export function CompaniesView() {
  const list = usePlatformCompaniesStore((s) => s.list);
  const stats = usePlatformCompaniesStore((s) => s.stats);
  const loaded = usePlatformCompaniesStore((s) => s.loaded);
  const load = usePlatformCompaniesStore((s) => s.load);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [verification, setVerification] = useState("");
  const [openId, setOpenId] = useState<Id | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (c) =>
        SEGMENTS[segment].match(c) &&
        (!verification || c.verification_status === verification) &&
        (!q || [c.name, c.legal_name, c.city, ...c.owners.flatMap((o) => [o.name, o.email])].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [list, search, segment, verification]);

  const pick = (key: string) => setSegment((s) => (s === key ? "all" : key));
  const tile = (key: string, value: number | undefined, icon: typeof Building2, tone?: string) => (
    <StatTile icon={icon} value={value ?? "—"} label={SEGMENTS[key].label} tone={tone} active={segment === key} onClick={() => pick(key)} />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Companies" description="Every company on Workkind — health, plan, and quick actions. Click a tile to filter." className="mb-0" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tile("all", stats?.total, Building2)}
        {tile("trialEnding", stats?.trialEnding, AlarmClock, "bg-warning/15 text-warning")}
        {tile("trial", stats?.trial, Hourglass, "bg-info/15 text-info")}
        {tile("paid", stats?.paid, Wallet, "bg-success/15 text-success")}
        {tile("pastDue", stats?.pastDue, CreditCard, "bg-destructive/15 text-destructive")}
        {tile("inactive", stats?.inactive, Moon, "bg-muted text-muted-foreground")}
        {tile("toReview", stats?.toReview, Search, "bg-warning/15 text-warning")}
        {tile("suspended", stats?.suspended, CircleAlert, "bg-destructive/15 text-destructive")}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading
          title={`${SEGMENTS[segment].label} · ${visible.length}`}
          actions={
            <>
              <Input placeholder="Search name, city, owner…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-56" aria-label="Search companies" />
              <SelectField size="sm" className="w-40" value={verification} onValueChange={setVerification} emptyLabel="All verification" options={VERIFICATION_OPTIONS} aria-label="Filter by verification" />
            </>
          }
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Active users (7d)</TableHead>
                <TableHead className="text-right">Checked in today</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Plan</TableHead>
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
                          <span className="block truncate text-xs text-muted-foreground">
                            {[c.city, c.state].filter(Boolean).join(", ") || "—"} · joined {fmtDate(c.created_at)}
                          </span>
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
                    <TableCell className="text-right tabular-nums">{c.employee_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.active_users_7d}
                      <span className="text-xs text-muted-foreground"> / {c.user_count}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.checkins_today}</TableCell>
                    <TableCell className={cn("text-sm", inactive(c) && "text-warning")}>{c.last_active_at ? timeAgo(c.last_active_at) : "Never"}</TableCell>
                    <TableCell>
                      <Plan c={c} />
                    </TableCell>
                    <TableCell>
                      <VerificationBadge status={c.verification_status} />
                    </TableCell>
                    <TableCell>
                      <CompanyStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => (e.stopPropagation(), setOpenId(c.id))}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <CompanyDetailsSheet companyId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
