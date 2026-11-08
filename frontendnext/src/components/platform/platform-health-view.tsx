"use client";

// Super Admin: is everything running — background jobs, email delivery, database, server
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Database, Mail, RefreshCw, Server, XCircle } from "lucide-react";
import { FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { platformService, type PlatformHealth } from "@/lib/services/platform-companies";
import { cn } from "@/lib/utils";

const STATE = {
  ok: { label: "Running", tone: "success", icon: CheckCircle2 },
  late: { label: "Late", tone: "warning", icon: Clock },
  failing: { label: "Failing", tone: "danger", icon: XCircle },
  waiting: { label: "Not run yet", tone: "neutral", icon: Clock },
} as const;

const every = (min: number) => (min >= 1440 ? "daily" : min >= 60 ? `every ${min / 60} h` : `every ${min} min`);
const uptime = (min: number) => (min >= 1440 ? `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h` : min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export function PlatformHealthView() {
  const [data, setData] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(false);

  // Loaded on open and on "Refresh" only (no polling)
  const load = useCallback(async () => {
    setLoading(true);
    const r = await run(() => platformService.health());
    setLoading(false);
    if (r.ok) setData(r.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    run(() => platformService.health()).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <div className="flex min-h-64 items-center justify-center">{<Spinner />}</div>;
  const problems = data.jobs.filter((j) => j.state === "failing" || j.state === "late").length + (data.mail.last7Days.failed > 0 ? 1 : 0) + (data.mail.smtpConfigured ? 0 : 1);
  const m = data.mail.last7Days;
  const mailMax = Math.max(1, ...data.mail.daily.map((d) => d.sent + d.failed + d.logged));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="System health"
        description="Background jobs, email delivery, database and server — at a glance."
        className="mb-0"
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw />} Refresh
          </Button>
        }
      />

      <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium", problems ? "border-warning/40 bg-warning/10" : "border-success/40 bg-success/10")}>
        {problems ? <AlertTriangle className="size-5 text-warning" /> : <CheckCircle2 className="size-5 text-success" />}
        {problems ? `${problems} thing${problems === 1 ? "" : "s"} need${problems === 1 ? "s" : ""} attention` : "Everything is running normally"}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title="Background jobs" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead className="text-right">Runs (24h)</TableHead>
                <TableHead>Last result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.jobs.map((j) => {
                const s = STATE[j.state];
                return (
                  <TableRow key={j.name}>
                    <TableCell>
                      <span className="font-medium">{j.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {j.what} · {every(j.everyMin)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={s.tone}>
                        <s.icon className="size-3" /> {s.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm">{j.last_run ? timeAgo(j.last_run) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {j.runs_24h}
                      {j.failed_24h > 0 && <span className="text-destructive"> ({j.failed_24h} failed)</span>}
                    </TableCell>
                    <TableCell className="max-w-80 text-sm">
                      {j.state === "failing" ? <span className="text-destructive">{j.last_error}</span> : <span className="text-muted-foreground">{j.last_detail ?? "Nothing to do"}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-3">
          <FormHeading title="Email · last 7 days" icon={Mail} />
          <div className="flex flex-col gap-4 p-4">
            {!data.mail.smtpConfigured && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">SMTP isn&apos;t set up — emails are only written to the server log. Add the SMTP_* values to the server&apos;s .env.</p>
            )}
            {data.mail.redirectedTo && <p className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm">Staging mode: every email goes to one test inbox (MAIL_REDIRECT_TO).</p>}
            <div className="grid grid-cols-3 gap-3">
              <StatTile icon={CheckCircle2} value={m.sent} label="Sent" tone="bg-success/15 text-success" />
              <StatTile icon={XCircle} value={m.failed} label="Failed" tone="bg-destructive/15 text-destructive" />
              <StatTile icon={Server} value={m.logged} label="Logged only" tone="bg-muted text-muted-foreground" />
            </div>
            <div className="flex h-24 items-end gap-2" role="img" aria-label="Emails per day">
              {data.mail.daily.map((d) => {
                const total = d.sent + d.failed + d.logged;
                return (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.sent} sent, ${d.failed} failed, ${d.logged} logged`}>
                    <div className="flex w-full max-w-8 flex-col-reverse gap-0.5" style={{ height: `${(total / mailMax) * 72}px` }}>
                      {d.sent > 0 && <div className="rounded-sm bg-success" style={{ flex: d.sent }} />}
                      {d.logged > 0 && <div className="rounded-sm bg-muted-foreground/40" style={{ flex: d.logged }} />}
                      {d.failed > 0 && <div className="rounded-sm bg-destructive" style={{ flex: d.failed }} />}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(`${d.day}T00:00:00Z`).toLocaleString("en-IN", { weekday: "short", timeZone: "UTC" })}</span>
                  </div>
                );
              })}
            </div>
            {data.mail.failures.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Recent failures</p>
                <ul className="divide-y rounded-lg border text-sm">
                  {data.mail.failures.map((f, i) => (
                    <li key={i} className="px-3 py-2">
                      <span className="font-medium">{f.subject}</span> → {f.to_email}
                      <span className="block text-xs text-destructive">
                        {f.error} · {fmtDateTime(f.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="overflow-hidden rounded-xl border bg-card">
            <FormHeading title="Database" icon={Database} />
            <div className="p-4 text-sm">
              <div className="mb-3 flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium">{data.database.size}</span>
              </div>
              <div className="mb-3 flex justify-between">
                <span className="text-muted-foreground">Open connections</span>
                <span className="font-medium tabular-nums">{data.database.connections}</span>
              </div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Biggest tables (rows)</p>
              <ul className="divide-y rounded-lg border">
                {data.database.biggestTables.map((t) => (
                  <li key={t.name} className="flex justify-between px-3 py-1.5">
                    <span className="font-mono text-xs">{t.name}</span>
                    <span className="tabular-nums">{t.rows.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className="overflow-hidden rounded-xl border bg-card">
            <FormHeading title="Server" icon={Server} />
            <dl className="divide-y px-4 text-sm">
              {[
                ["Environment", data.server.environment],
                ["Up for", uptime(data.server.uptimeMin)],
                ["Started", fmtDateTime(data.server.startedAt)],
                ["Memory", `${data.server.memoryMb} MB (heap ${data.server.heapMb} MB)`],
                ["Node", data.server.node],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
