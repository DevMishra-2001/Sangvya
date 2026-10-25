"use client";

import { useCallback, useEffect, useState } from "react";
import { NotLinkedState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { CheckInButton } from "@/components/attendance/check-in-dialog";
import { PunchProof } from "@/components/attendance/punch-proof";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { ATTENDANCE_FLAGS, FLAG_META, LOCATION_LABELS, SHORT_LEAVE_LABELS } from "@/lib/constants";
import { fmtMinutes, fmtTime, isoDate } from "@/lib/format";
import { selfService } from "@/lib/services/self";
import type { AttendanceDayResponse } from "@/lib/types";
import { useUser } from "@/stores/auth-store";
import { DatePicker } from "@/components/common/date-picker";

const minutesBetween = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

// One day of my own attendance: every work session (punch in → out) with its
// location and remarks, plus check-in / check-out (the time is always "now").
export function TodayView() {
  const user = useUser();
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [data, setData] = useState<AttendanceDayResponse | null>(null);

  const load = useCallback((d: string) => {
    let cancelled = false;
    run(() => selfService.attendanceDay(d)).then((result) => {
      if (!cancelled && result.ok) setData(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user.employee_id && date) return load(date);
  }, [user.employee_id, date, load]);

  if (!user.employee_id) return <NotLinkedState />;

  const day = data?.day;
  const isToday = data?.date === data?.today;
  const working = Boolean(day?.punchIn) && !day?.punchOut; // punched out = on a break or done
  const leave = data?.leaves.find((l) => l.status !== "rejected");
  const statusMeta = data && data.status !== "none" ? FLAG_META[data.status] : null;
  const sessions = day?.sessions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attendance"
        description={data ? `${data.employee.name}${data.employee.code ? ` · ${data.employee.code}` : ""}` : undefined}
        className="mb-0"
        actions={<DatePicker value={date} onChange={setDate} max={isoDate(new Date())} className="w-44" aria-label="Date" />}
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Day status">
        {ATTENDANCE_FLAGS.map((f) => {
          const on = data?.flags.includes(f.key);
          return (
            <span key={f.key} className={on ? "flex items-center gap-1.5 font-semibold" : "flex items-center gap-1.5 text-muted-foreground"}>
              <span className="size-2.5 rounded-full" style={{ background: f.color, opacity: on ? 1 : 0.35 }} />
              {f.label}
            </span>
          );
        })}
      </div>

      {isToday && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{working ? "You're checked in" : "Check in"}</CardTitle>
            <CardDescription>A photo, your location and work mode are saved with every check-in and check-out.</CardDescription>
            <CardAction>
              <CheckInButton onDone={() => load(date)} />
            </CardAction>
          </CardHeader>
        </Card>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Logout</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Break after</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {data?.holiday ? `Holiday: ${data.holiday.name}` : leave ? `${SHORT_LEAVE_LABELS[leave.leave_type]} (${leave.status})` : "No attendance for this day."}
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s, i) => {
                const next = sessions[i + 1];
                const last = i === sessions.length - 1;
                return (
                  <TableRow key={s.in}>
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell className="tabular-nums">{fmtTime(s.in)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {s.inLocation ? LOCATION_LABELS[s.inLocation] : "—"}
                        <PunchProof photo={s.inPhoto} geo={s.inGeo} label={`Login ${i + 1}`} />
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{s.out ? fmtTime(s.out) : "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {s.outLocation ? LOCATION_LABELS[s.outLocation] : "—"}
                        <PunchProof photo={s.outPhoto} geo={s.outGeo} label={`Logout ${i + 1}`} />
                      </span>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{[s.inRemarks, s.outRemarks].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="tabular-nums">{s.out && next ? fmtMinutes(minutesBetween(s.out, next.in)) : "—"}</TableCell>
                    <TableCell>
                      {!last ? (
                        <span className="text-muted-foreground">Completed</span>
                      ) : statusMeta ? (
                        <span className="font-semibold" style={{ color: statusMeta.color }}>
                          {statusMeta.label}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
