import type { Metadata } from "next";
import { HomeView } from "@/components/dashboard/home-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageGate>
      <HomeView />
    </PageGate>
  );
}
