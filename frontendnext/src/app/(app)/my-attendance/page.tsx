import type { Metadata } from "next";
import { TodayView } from "@/components/my-attendance/today-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "My Attendance" };

export default function Page() {
  return (
    <PageGate>
      <TodayView />
    </PageGate>
  );
}
