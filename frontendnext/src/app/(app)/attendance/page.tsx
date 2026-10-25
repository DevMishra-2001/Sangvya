import type { Metadata } from "next";
import { TeamAttendanceView } from "@/components/attendance/team-attendance-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Team Attendance" };

export default function Page() {
  return (
    <PageGate>
      <TeamAttendanceView />
    </PageGate>
  );
}
