"use client";

// Super Admin: money (MRR, payments, conversions) and usage (logins, check-ins, modules, who's slipping away)
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AlarmClock, Building2, IndianRupee, Percent, TrendingUp, Wallet } from "lucide-react";
import { FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { fmtDate, inr, timeAgo } from "@/lib/format";
import { platformService, type InsightsCompany, type PlatformInsights } from "@/lib/services/platform-companies";

const monthName = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const dayName = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const revenueConfig = { revenue: { label: "Collected", color: "var(--chart-1)" } } satisfies ChartConfig;
const companiesConfig = { companies: { label: "New companies", color: "var(--chart-2)" } } satisfies ChartConfig;
const dailyConfig = { logins: { label: "Logins", color: "var(--chart-1)" }, checkins: { label: "Check-ins", color: "var(--chart-2)" } } satisfies ChartConfig;

const MODULE_LABELS: Record<string, string> = {
  attendance: "Check-ins",
  leave: "Leave requests",
  payroll: "Payslips",
  recruitment: "Candidates",
  performance: "Reviews",
  tasks: "Tasks",
  assets: "Assets given",
};

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-xl border bg-card ${className ?? ""}`}>
      <FormHeading title={title} />
      {children}
    </section>
  );
}

function CompanyTable({ rows, empty, extra }: { rows: InsightsCompany[]; empty: string; extra: { head: string; cell: (c: InsightsCompany) => React.ReactNode } }) {
  if (!rows.length) return <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead className="text-right">Employees</TableHead>
          <TableHead>{extra.head}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-right tabular-nums">{c.employees}</TableCell>
            <TableCell className="text-sm">{extra.cell(c)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PlatformInsightsView() {
  const [data, setData] = useState<PlatformInsights | null>(null);

  useEffect(() => {
    let cancelled = false;
    run(() => platformService.insights()).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <div className="flex min-h-64 items-center justify-center">{<Spinner />}</div>;
  const r = data.revenue;
  const moduleMax = Math.max(1, ...Object.values(data.modules));
  const lastActive = (c: InsightsCompany) => (c.last_active_at ? timeAgo(c.last_active_at) : "Never");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Revenue & usage"
        description="What Workkind earns and how much companies actually use it."
        className="mb-0"
        actions={
          <Link href="/companies" className="text-sm font-medium text-primary hover:underline">
            All companies →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={IndianRupee} value={inr(r.mrr)} label="Monthly revenue (MRR)" tone="bg-success/15 text-success" />
        <StatTile icon={TrendingUp} value={inr(r.arr)} label="Yearly run rate" />
        <StatTile icon={Wallet} value={r.paying} label={`Paying · ${inr(r.avgPerCompany)} avg`} tone="bg-success/15 text-success" />
        <StatTile icon={Building2} value={r.trial} label="On trial" tone="bg-info/15 text-info" />
        <StatTile icon={Percent} value={r.conversionRate == null ? "—" : `${r.conversionRate}%`} label="Trials that paid" tone="bg-violet-500/12 text-violet-600 dark:text-violet-400" />
        <StatTile icon={AlarmClock} value={r.pastDue} label="Payment due" tone="bg-destructive/15 text-destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Money collected · last 12 months">
          <div className="p-4">
            <ChartContainer config={revenueConfig} className="aspect-auto h-56 w-full">
              <BarChart data={data.monthly} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} />
                <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent labelFormatter={(v) => monthName(String(v))} formatter={(v) => inr(Number(v))} />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>
        <Card title="New companies · last 12 months">
          <div className="p-4">
            <ChartContainer config={companiesConfig} className="aspect-auto h-56 w-full">
              <BarChart data={data.monthly} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="month" tickFormatter={monthName} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent labelFormatter={(v) => monthName(String(v))} />} />
                <Bar dataKey="companies" fill="var(--color-companies)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Daily activity · last 30 days" className="lg:col-span-3">
          <div className="p-4">
            <ChartContainer config={dailyConfig} className="aspect-auto h-60 w-full">
              <LineChart data={data.daily} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="day" tickFormatter={dayName} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => dayName(String(v))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line dataKey="logins" type="monotone" stroke="var(--color-logins)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line dataKey="checkins" type="monotone" stroke="var(--color-checkins)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </div>
        </Card>
        <Card title="Module use · last 30 days" className="lg:col-span-2">
          <ul className="flex flex-col gap-3 p-4">
            {Object.entries(data.modules)
              .sort((a, b) => b[1] - a[1])
              .map(([key, n]) => (
                <li key={key} className="text-sm">
                  <div className="mb-1 flex justify-between">
                    <span>{MODULE_LABELS[key] ?? key}</span>
                    <span className="text-muted-foreground tabular-nums">{n.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(n / moduleMax) * 100}%` }} />
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Trials ending in 7 days — call them">
          <CompanyTable rows={data.trialsEnding} empty="No trials ending this week." extra={{ head: "Trial ends", cell: (c) => `${fmtDate(c.trial_ends_at)} · active ${lastActive(c)}` }} />
        </Card>
        <Card title="Quiet for 14+ days — at risk">
          <CompanyTable rows={data.atRisk} empty="Every company used Workkind in the last two weeks." extra={{ head: "Last active", cell: lastActive }} />
        </Card>
        <Card title="Most active (users this week)">
          <CompanyTable rows={data.mostActive} empty="No activity this week." extra={{ head: "Active users", cell: (c) => c.active_users_7d }} />
        </Card>
        <Card title="Top paying">
          <CompanyTable rows={data.topRevenue} empty="No paying companies yet." extra={{ head: "Per month", cell: (c) => inr(Number(c.mrr)) }} />
        </Card>
      </div>

      {data.pastDue.length > 0 && (
        <Card title="Payment due">
          <CompanyTable rows={data.pastDue} empty="" extra={{ head: "Last active", cell: lastActive }} />
        </Card>
      )}
    </div>
  );
}
