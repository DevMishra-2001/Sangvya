"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Building2, CircleAlert, IndianRupee, ShieldCheck, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AuditActionBadge } from "@/components/audit/audit-action-badge";
import { PageHeader } from "@/components/common/page-header";
import { FormHeading } from "@/components/common/form-layout";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { fmtDate, timeAgo } from "@/lib/format";
import { platformService } from "@/lib/services/platform-companies";
import type { PlatformOverview } from "@/lib/types";
import { VerificationBadge } from "./company-badges";

const chartConfig = { companies: { label: "New companies", color: "var(--chart-1)" } } satisfies ChartConfig;
const monthName = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short", timeZone: "UTC" });

function Tile({ label, value, hint, icon: Icon, tone }: { label: string; value: React.ReactNode; hint?: string; icon: typeof Building2; tone?: string }) {
  return (
    <div className="flex items-start justify-between rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
      </div>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone ?? "bg-primary/10 text-primary"}`}>
        <Icon className="size-5" />
      </span>
    </div>
  );
}

// Super Admin landing page: the whole platform at a glance
export function PlatformOverviewView() {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platformService
      .overview()
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (!data) {
    return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">{error ?? <Spinner />}</div>;
  }
  const { companies: c, subscriptions: s } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Platform overview" description="Companies, people and subscriptions across Workkind." className="mb-0" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Companies" value={c.total} hint={`${c.verified} verified`} icon={Building2} />
        <Tile label="Active" value={c.active} hint={c.suspended ? `${c.suspended} suspended` : "None suspended"} icon={ShieldCheck} tone="bg-success/15 text-success" />
        <Tile label="Waiting for review" value={c.toReview} icon={CircleAlert} tone="bg-warning/15 text-warning" />
        <Tile label="Employees" value={data.employees} hint={`${data.logins} logins`} icon={Users} />
        <Tile label="Active users" value={data.activeUsers30d} hint="Last 30 days" icon={Activity} />
        <Tile label="Monthly revenue" value={`₹${s.mrr.toLocaleString("en-IN")}`} hint={`${s.active} paying · ${s.trial} on trial`} icon={IndianRupee} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-3">
          <FormHeading title="New companies · last 6 months" />
          <div className="p-4">
            <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
              <BarChart data={data.growth} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent labelFormatter={(v) => monthName(String(v))} />} />
                <Bar dataKey="companies" fill="var(--color-companies)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <FormHeading
            title="Waiting for review"
            actions={
              <Link href="/companies" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                All companies <ArrowRight className="size-3" />
              </Link>
            }
          />
          {data.toReview.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing to review.</p>
          ) : (
            <ul className="divide-y">
              {data.toReview.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">Joined {fmtDate(r.created_at)}</span>
                  </span>
                  <VerificationBadge status={r.verification_status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading
          title="Recent activity"
          actions={
            <Link href="/audit-log" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Audit log <ArrowRight className="size-3" />
            </Link>
          }
        />
        {data.recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y">
            {data.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <AuditActionBadge action={e.action} />
                <span className="min-w-0 flex-1">{e.summary}</span>
                <span className="text-xs text-muted-foreground">
                  {e.actor_email ?? "System"} · {timeAgo(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
