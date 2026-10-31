"use client";

import { PunchCard } from "@/components/attendance/punch-card";
import { useCan, useUser } from "@/stores/auth-store";
import { AnnouncementsPanel } from "./announcements-panel";
import { BirthdayPanel } from "./birthday-panel";
import { CompanyOverview } from "./company-overview";
import { ProgressGraph } from "./progress-graph";
import { WelcomeCard } from "./welcome-card";

export function DashboardView() {
  const can = useCan();
  const user = useUser();
  const showCompany = can("dashboard.company");
  const showPunch = can("attendance.self") && Boolean(user.employee_id);

  return (
    <div className="flex flex-col gap-6">
      {/* Admin / HR: greeting + the whole company at a glance; others just the greeting */}
      {showCompany ? <CompanyOverview welcome={<WelcomeCard />} /> : <WelcomeCard />}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {user.employee_id && <ProgressGraph />}
        <AnnouncementsPanel />
        <BirthdayPanel />
      </div>

      {showPunch && <PunchCard />}
    </div>
  );
}
