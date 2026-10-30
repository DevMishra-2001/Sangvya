"use client";

import { PunchCard } from "@/components/attendance/punch-card";
import { PageHeader } from "@/components/common/page-header";
import { useCan, useUser } from "@/stores/auth-store";
import { AnnouncementsPanel } from "./announcements-panel";
import { BirthdayPanel } from "./birthday-panel";
import { CompanyOverview } from "./company-overview";
import { ProgressGraph } from "./progress-graph";

export function DashboardView() {
  const can = useCan();
  const user = useUser();
  const showCompany = can("dashboard.company");
  const showPunch = can("attendance.self") && Boolean(user.employee_id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description={showCompany ? "Your company and your day at a glance." : "Your day at a glance."} className="mb-0" />

      {/* Admin / HR: the whole company at a glance */}
      {showCompany && <CompanyOverview />}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {user.employee_id && <ProgressGraph />}
        <AnnouncementsPanel />
        <BirthdayPanel />
      </div>

      {showPunch && <PunchCard />}
    </div>
  );
}
