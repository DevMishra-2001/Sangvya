"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlarmClockOff, ArrowRight, CalendarClock, CheckCircle2, Circle, PartyPopper, UserCheck, UserMinus, Users } from "lucide-react";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { canVisit } from "@/lib/permissions";
import { errorMessage } from "@/lib/api/client";
import { SHORT_LEAVE_LABELS } from "@/lib/constants";
import { dashboardService } from "@/lib/services/dashboard";
import type { CompanyOverview as Overview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { pageUrls } from "@/components/layout/nav-items";

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
const when = (iso: string, today: string) => (iso === today ? "Today" : `${weekday(iso)}, ${day(iso)}`);

function Tile({ label, value, hint, icon: Icon, tone }: { label: string; value: React.ReactNode; hint?: string; icon: typeof Users; tone: string }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
          {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function Panel({ title, icon: Icon, action, children, className }: { title: string; icon: typeof Users; action?: { href: string; label: string }; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4" /> {title}
        </CardTitle>
        {action && (
          <Link href={action.href} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {action.label} <ArrowRight className="size-3" />
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>;

// Today's attendance as one bar: present (on time / late), on leave, not in yet
function AttendanceBar({ a }: { a: NonNullable<Overview["attendance"]> }) {
  const parts = [
    { label: "On time", value: a.present - a.late, className: "bg-success" },
    { label: "Late", value: a.late, className: "bg-warning" },
    { label: "On leave", value: a.onLeave, className: "bg-info" },
    { label: "Not in yet", value: a.notIn, className: "bg-muted-foreground/40" },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => <div key={p.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", p.className)} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={cn("size-2 rounded-full", p.className)} /> {p.label}
            </span>
            <span className="font-medium tabular-nums">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin / HR: the company at a glance — headcount, today's attendance, approvals waiting, HR alerts, upcoming events, headcount by department and setup progress
export function CompanyOverview() {
  const pages = useAuthStore((s) => s.pages);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardService
      .overview()
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading company overview">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const urls = pageUrls(pages);
  const open = (url: string | null) => Boolean(url && canVisit(urls, url));
  const { attendance: a, leave, alerts, upcoming, headcount } = data;
  const setupDone = data.setup.filter((s) => s.done).length;
  const maxDept = Math.max(1, ...data.departments.map((d) => d.count));
  const nothingUpcoming = !upcoming.birthdays.length && !upcoming.anniversaries.length && !upcoming.holidays.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Total employees"
          value={headcount.total}
          hint={[headcount.newThisMonth ? `+${headcount.newThisMonth} this month` : "No new joiners this month", headcount.onNotice && `${headcount.onNotice} on notice`].filter(Boolean).join(" · ")}
          icon={Users}
          tone="bg-primary/10 text-primary"
        />
        {a && (
          <Tile
            label="Present today"
            value={a.present}
            hint={data.workingDay.isWorkingDay ? `${a.rate}% attendance${a.late ? ` · ${a.late} late` : ""}` : (data.workingDay.holiday ?? "Not a working day")}
            icon={UserCheck}
            tone="bg-success/15 text-success"
          />
        )}
        {(a || leave) && <Tile label="On leave today" value={a?.onLeave ?? 0} hint="Approved leave" icon={CalendarClock} tone="bg-info/15 text-info" />}
        {a && (
          <Tile
            label="Not in yet"
            value={data.workingDay.isWorkingDay ? a.notIn : "—"}
            hint={data.workingDay.isWorkingDay ? "No check-in or leave today" : (data.workingDay.holiday ? `Holiday · ${data.workingDay.holiday}` : "Day off")}
            icon={UserMinus}
            tone="bg-warning/15 text-warning"
          />
        )}
        {!a && leave && <Tile label="Leave requests" value={leave.pendingCount} hint="Waiting for approval" icon={CalendarClock} tone="bg-warning/15 text-warning" />}
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {a && (
          <Panel title="Today's attendance" icon={UserCheck} action={open("/attendance") ? { href: "/attendance", label: "Team attendance" } : undefined}>
            {data.workingDay.isWorkingDay ? <AttendanceBar a={a} /> : <Empty>{data.workingDay.holiday ? `Holiday — ${data.workingDay.holiday}` : "Not a working day."}</Empty>}
          </Panel>
        )}

        {leave && (
          <Panel title={`Pending approvals · ${leave.pendingCount + (data.corrections?.pendingCount ?? 0)}`} icon={CalendarClock} action={open("/leave") ? { href: "/leave", label: "Review" } : undefined}>
            {!!data.corrections?.pendingCount && (
              <Link href="/my-attendance/corrections" className="mb-1 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm hover:bg-muted">
                <span>
                  {data.corrections.pendingCount} attendance correction{data.corrections.pendingCount === 1 ? "" : "s"}
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            )}
            {leave.pending.length === 0 ? (
              <Empty>No leave requests waiting.</Empty>
            ) : (
              <ul className="divide-y">
                {leave.pending.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{l.employee_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {SHORT_LEAVE_LABELS[l.leave_type] ?? l.leave_type} · {day(l.from_date)}
                      {l.to_date !== l.from_date && ` – ${day(l.to_date)}`} · {l.days}d
                      <span className="block text-right">{l.approver_name ? `With ${l.approver_name}` : "Needs HR"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {alerts && (
          <Panel title="HR alerts" icon={AlarmClockOff} action={open("/attendance") && alerts.missingPunchOutCount ? { href: "/attendance", label: "Check" } : undefined}>
            {alerts.missingPunchOutCount === 0 ? (
              <Empty>No missing punch-outs in the last 7 days.</Empty>
            ) : (
              <>
                <p className="mb-1 text-xs text-muted-foreground">
                  {alerts.missingPunchOutCount} missing punch-out{alerts.missingPunchOutCount === 1 ? "" : "s"} in the last 7 days
                </p>
                <ul className="divide-y">
                  {alerts.missingPunchOuts.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{m.employee_name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{when(m.date, data.date)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Panel title="Coming up" icon={PartyPopper}>
          {nothingUpcoming ? (
            <Empty>No birthdays, work anniversaries or holidays coming up.</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {upcoming.birthdays.map((b) => (
                <li key={`b${b.id}`} className="flex items-center gap-2.5">
                  <PersonAvatar name={b.name} photoUrl={b.photo_url} className="size-7" />
                  <span className="min-w-0 flex-1 truncate">🎂 {b.name}&apos;s birthday</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(b.date, data.date)}</span>
                </li>
              ))}
              {upcoming.anniversaries.map((w) => (
                <li key={`a${w.id}`} className="flex items-center gap-2.5">
                  <PersonAvatar name={w.name} photoUrl={w.photo_url} className="size-7" />
                  <span className="min-w-0 flex-1 truncate">
                    🎉 {w.name} · {w.years} year{w.years === 1 ? "" : "s"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(w.date, data.date)}</span>
                </li>
              ))}
              {upcoming.holidays.map((h) => (
                <li key={`h${h.date}`} className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-info/15 text-xs">🏖️</span>
                  <span className="min-w-0 flex-1 truncate">
                    {h.name}
                    {h.is_optional && <span className="text-xs text-muted-foreground"> · optional</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(h.date, data.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Headcount by department" icon={Users} action={open("/departments") ? { href: "/departments", label: "Departments" } : undefined}>
          {data.departments.length === 0 ? (
            <Empty>No employees yet.</Empty>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.departments.slice(0, 6).map((d) => (
                <li key={d.name} className="text-sm">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className={cn("truncate", d.name === "No department" && "text-muted-foreground")}>{d.name}</span>
                    <span className="font-medium tabular-nums">{d.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / maxDept) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {setupDone < data.setup.length && (
          <Panel title={`Finish setting up · ${setupDone}/${data.setup.length}`} icon={CheckCircle2}>
            <Progress value={(setupDone / data.setup.length) * 100} className="mb-3 h-1.5" aria-label="Setup progress" />
            <ul className="flex flex-col gap-1.5 text-sm">
              {data.setup.map((s) => {
                const Icon = s.done ? CheckCircle2 : Circle;
                const label = <span className={cn(s.done && "text-muted-foreground line-through")}>{s.label}</span>;
                return (
                  <li key={s.key} className="flex items-center gap-2">
                    <Icon className={cn("size-4 shrink-0", s.done ? "text-success" : "text-muted-foreground")} />
                    {!s.done && open(s.url) ? (
                      <Link href={s.url!} className="hover:text-primary hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
