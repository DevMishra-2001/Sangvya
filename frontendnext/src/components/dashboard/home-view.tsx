"use client";

import { PlatformOverviewView } from "@/components/platform/platform-overview-view";
import { useCan, useUser } from "@/stores/auth-store";
import { DashboardView } from "./dashboard-view";

// "/": the Super Admin without a company sees the platform overview;
// everyone else their company dashboard
export function HomeView() {
  const can = useCan();
  const user = useUser();
  return !user.company_id && can("platform.overview") ? <PlatformOverviewView /> : <DashboardView />;
}
