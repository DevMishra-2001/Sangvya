"use client";

import { useEffect, useMemo, useState } from "react";
import { NotLinkedState } from "@/components/common/empty-state";
import { MonthPicker } from "@/components/common/month-picker";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, type Tone } from "@/components/common/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { run } from "@/lib/api/run";
import { BALANCE_TYPES, LEAVE_TYPE_LABELS, SHORT_LEAVE_LABELS } from "@/lib/constants";
import { fmtDay, fmtMinutes, fmtTime, isoDate, monthLabel, toMonth, weekday } from "@/lib/format";
import { selfService } from "@/lib/services/self";
import type { AttendanceDay, Holiday, Leave, MyLeavesResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUser } from "@/stores/auth-store";
import { useCalendar } from "./use-calendar";

function daysOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => isoDate(new Date(y, m - 1, i + 1)));
}

interface Row {
  date: string;
  day?: AttendanceDay;
  holiday?: Holiday;
  leave?: Leave;
  status: { label: string; tone?: Tone };
}

// What a day's row says in the Status column
function dayStatus(date: string, today: string, weeklyOffs: number[], day?: AttendanceDay, holiday?: Holiday, leave?: Leave): Row["status"] {
  if (day?.punchIn) {
    if (!day.punchOut) return { label: date === today ? "In progress" : "No check-out", tone: "warning" };
    if (day.shortDay) return { label: "Short day", tone: "danger" };
    if (day.longBreak) return { label: "Long break", tone: "warning" };
    if (day.lateMinutes) return { label: `Late ${day.lateMinutes}m`, tone: "warning" };
    return { label: "Present", tone: "success" };
  }
  if (leave) return { label: `${SHORT_LEAVE_LABELS[leave.leave_type]} · ${leave.status}`, tone: leave.status === "approved" ? "success" : "warning" };
  if (holiday && !holiday.is_optional) return { label: holiday.name, tone: "info" };
  if (weeklyOffs.includes(new Date(`${date}T00:00:00`).getDay())) return { label: "Weekly off", tone: "neutral" };
  if (date > today) return { label: "—" };
  if (day?.status === "present") return { label: "Present", tone: "success" };
  if (day?.status === "half") return { label: "Half day", tone: "warning" };
  return { label: "Absent", tone: "danger" };
}

function Summary({ items }: { items: { label: string; value: string | number; warn?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((s) => (
        <Card key={s.label} className="gap-1 py-3">
          <CardContent>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={cn("text-2xl font-semibold tabular-nums", s.warn && s.value ? "text-destructive" : undefined)}>{s.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Month-wise attendance report and leave report
export function ReportView() {
  const user = useUser();
  const [month, setMonth] = useState(() => toMonth(new Date()));
  const [leaves, setLeaves] = useState<MyLeavesResponse | null>(null);
  const { calendar } = useCalendar(month, Boolean(user.employee_id));

  useEffect(() => {
    if (!user.employee_id) return;
    run(() => selfService.leaves(month)).then((r) => r.ok && setLeaves(r.data));
  }, [month, user.employee_id]);

  const rows: Row[] = useMemo(() => {
    if (!calendar) return [];
    const byDay = Object.fromEntries(calendar.days.map((d) => [d.date, d]));
    const holidays = Object.fromEntries(calendar.holidays.map((h) => [h.date, h]));
    return daysOf(month).map((date) => {
      const leave = calendar.leaves.find((l) => (l.status === "pending" || l.status === "approved") && l.from_date <= date && l.to_date >= date);
      return { date, day: byDay[date], holiday: holidays[date], leave, status: dayStatus(date, calendar.today, calendar.weeklyOffs ?? [0], byDay[date], holidays[date], leave) };
    });
  }, [calendar, month]);

  if (!user.employee_id) return <NotLinkedState />;

  const worked = rows.filter((r) => r.day?.punchOut);
  const monthLeaves = leaves?.month === month ? leaves.leaves : [];
  const balances = calendar?.balances;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={`Report — ${monthLabel(month)}`} className="mb-0" actions={<MonthPicker value={month} onChange={setMonth} />} />
      <Tabs defaultValue="attendance">
        <TabsList className="mb-4">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="flex flex-col gap-4">
          <Summary
            items={[
              { label: "Present", value: worked.length },
              { label: "Short days", value: worked.filter((r) => r.day?.shortDay).length, warn: true },
              { label: "Late days", value: worked.filter((r) => r.day?.lateMinutes).length, warn: true },
              { label: "Absent", value: rows.filter((r) => r.status.label === "Absent").length, warn: true },
              { label: "Leaves", value: rows.filter((r) => r.leave && !r.day?.punchIn).length },
              { label: "Total hours", value: fmtMinutes(worked.reduce((s, r) => s + (r.day?.totalMinutes ?? 0), 0)) },
            ]}
          />
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Logout</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Work hours</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.date}>
                    <TableCell className="tabular-nums">{fmtDay(r.date)}</TableCell>
                    <TableCell>{weekday(r.date, "short")}</TableCell>
                    <TableCell className="tabular-nums">{fmtTime(r.day?.punchIn)}</TableCell>
                    <TableCell className="tabular-nums">{fmtTime(r.day?.punchOut)}</TableCell>
                    <TableCell className={cn("tabular-nums", r.day?.longBreak && "text-destructive")}>{r.day?.punchIn ? fmtMinutes(r.day.breakMinutes) : "—"}</TableCell>
                    <TableCell className={cn("font-medium tabular-nums", r.day?.shortDay && "text-destructive")}>{r.day?.punchOut ? fmtMinutes(r.day.totalMinutes) : "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.day?.punchOut ? fmtMinutes(Math.max(0, r.day.totalMinutes - r.day.breakMinutes)) : "—"}</TableCell>
                    <TableCell>{r.status.tone ? <StatusBadge tone={r.status.tone} className="normal-case">{r.status.label}</StatusBadge> : <span className="text-muted-foreground">{r.status.label}</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="flex flex-col gap-4">
          <Summary
            items={[
              ...BALANCE_TYPES.map((t) => ({ label: `${SHORT_LEAVE_LABELS[t]} available`, value: balances ? `${balances[t].available} / ${balances[t].quota}` : "—" })),
              { label: "Leave days this month", value: monthLeaves.filter((l) => l.status !== "rejected").reduce((s, l) => s + l.days, 0) },
            ]}
          />
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Decided by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No leaves this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  monthLeaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{LEAVE_TYPE_LABELS[l.leave_type]}</TableCell>
                      <TableCell className="tabular-nums">{fmtDay(l.from_date)}</TableCell>
                      <TableCell className="tabular-nums">{fmtDay(l.to_date)}</TableCell>
                      <TableCell className="tabular-nums">{l.days}</TableCell>
                      <TableCell className="max-w-64 truncate">{l.reason || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                      <TableCell>{l.reviewed_by_name || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
