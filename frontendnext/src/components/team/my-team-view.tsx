"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PersonAvatar } from "@/components/common/person-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { SHORT_LEAVE_LABELS } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/format";
import { selfService } from "@/lib/services/self";
import type { MyTeam, TeamDayState } from "@/lib/types";
import { useUser } from "@/stores/auth-store";

const STATE: Record<TeamDayState, { label: string; tone: "success" | "warning" | "info" | "neutral" }> = {
  in: { label: "In", tone: "success" },
  late: { label: "Late", tone: "warning" },
  out: { label: "Checked out", tone: "neutral" },
  leave: { label: "On leave", tone: "info" },
  not_in: { label: "Not in yet", tone: "neutral" },
};

// A manager's team: everyone whose "Reports to" is me — today's attendance, who's on leave, and leave requests waiting for my decision.
export function MyTeamView() {
  const user = useUser();
  const [team, setTeam] = useState<MyTeam | null>(null);

  useEffect(() => {
    if (!user.employee_id) return;
    run(selfService.team).then((r) => r.ok && setTeam(r.data));
  }, [user.employee_id]);

  if (!user.employee_id) return <NotLinkedState />;

  const showAttendance = team?.members.some((m) => m.today) ?? false;
  const showLeave = team?.pendingLeaves !== null && team?.pendingLeaves !== undefined;
  const count = (s: TeamDayState) => team?.members.filter((m) => m.today?.state === s).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My Team"
        description="People who report to you. You approve their leave, and you get an email when their day is short or they forget to check out."
        className="mb-0"
      />

      {!team ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : team.members.length === 0 ? (
        <EmptyState icon={Users} title="Nobody reports to you" description="When someone's “Reports to” is set to you, they show up here." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <StatusBadge tone="neutral" className="normal-case">
              {team.members.length} {team.members.length === 1 ? "person" : "people"}
            </StatusBadge>
            {showAttendance &&
              (["in", "late", "out", "leave", "not_in"] as const).map((s) => (
                <StatusBadge key={s} tone={STATE[s].tone} className="normal-case">
                  {STATE[s].label}: {count(s)}
                </StatusBadge>
              ))}
            {!!team.pendingCorrections && (
              <Link href="/my-attendance/corrections" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {team.pendingCorrections} correction{team.pendingCorrections === 1 ? "" : "s"} to review <ArrowRight className="size-3.5" />
              </Link>
            )}
            {showLeave && !!team.pendingLeaves && (
              <Link href="/leave" className="ml-auto flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {team.pendingLeaves} leave request{team.pendingLeaves === 1 ? "" : "s"} waiting for you <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>

          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  {showAttendance && <TableHead>Today</TableHead>}
                  {showAttendance && <TableHead>In / out</TableHead>}
                  {showLeave && <TableHead className="text-right">Leave to decide</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2.5">
                        <PersonAvatar name={m.name} photoUrl={m.photo_url} />
                        <span className="min-w-0">
                          <span className="block truncate">{m.name}</span>
                          {m.status === "notice" && <span className="block text-xs text-warning">On notice · last day {fmtDate(m.exit_date)}</span>}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>{[m.designation, m.department].filter(Boolean).join(" · ") || "—"}</TableCell>
                    {showAttendance && (
                      <TableCell>
                        {m.today && (
                          <StatusBadge tone={STATE[m.today.state].tone} className="normal-case">
                            {STATE[m.today.state].label}
                            {m.on_leave && ` · ${SHORT_LEAVE_LABELS[m.on_leave.leave_type] ?? "Leave"} till ${fmtDate(m.on_leave.until)}`}
                          </StatusBadge>
                        )}
                      </TableCell>
                    )}
                    {showAttendance && (
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {m.today?.punch_in ? `${fmtTime(m.today.punch_in)} – ${m.today.punch_out ? fmtTime(m.today.punch_out) : "now"}` : "—"}
                      </TableCell>
                    )}
                    {showLeave && <TableCell className="text-right tabular-nums">{m.pending_leaves || "—"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
