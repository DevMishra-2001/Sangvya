"use client";

import { useEffect, useState } from "react";
import { CalendarClock, UserCheck, Users } from "lucide-react";
import { PunchCard } from "@/components/attendance/punch-card";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { isoDate } from "@/lib/format";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useCan, useUser } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { useLeavesStore } from "@/stores/leaves-store";
import { AnnouncementsPanel } from "./announcements-panel";
import { BirthdayPanel } from "./birthday-panel";
import { ProgressGraph } from "./progress-graph";

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const can = useCan();
  const user = useUser();
  const showEmployees = can("employees.view");
  const showAttendance = can("attendance.view");
  const viewAllLeaves = can("leave.viewAll");
  const showPunch = can("attendance.self") && Boolean(user.employee_id);
  const [today] = useState(() => isoDate(new Date()));

  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const leaves = useLeavesStore((s) => s.list);
  const loadLeaves = useLeavesStore((s) => s.load);
  const todayAttendance = useAttendanceStore((s) => s.byDate[today]);
  const loadAttendance = useAttendanceStore((s) => s.load);

  useEffect(() => {
    if (showEmployees) loadEmployees();
    if (viewAllLeaves) loadLeaves();
    if (showAttendance) loadAttendance(today);
  }, [showEmployees, viewAllLeaves, showAttendance, today, loadEmployees, loadLeaves, loadAttendance]);

  const presentCount = (todayAttendance ?? []).filter((r) => r.status === "present").length;
  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Your day at a glance." className="mb-0" />

      {(showEmployees || showAttendance || viewAllLeaves) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {showEmployees && <StatCard label="Total employees" value={employees.length} icon={Users} />}
          {showAttendance && <StatCard label="Present today" value={presentCount} icon={UserCheck} />}
          {viewAllLeaves && <StatCard label="Pending leave requests" value={pendingLeaves} icon={CalendarClock} />}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {user.employee_id && <ProgressGraph />}
        <AnnouncementsPanel />
        <BirthdayPanel />
      </div>

      {showPunch && <PunchCard />}
    </div>
  );
}
