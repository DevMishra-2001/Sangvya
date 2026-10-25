import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageGate>
      <DashboardView />
    </PageGate>
  );
}
