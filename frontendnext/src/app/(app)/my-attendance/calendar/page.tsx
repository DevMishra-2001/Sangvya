import type { Metadata } from "next";
import { CalendarView } from "@/components/my-attendance/calendar-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Attendance Calendar" };

export default function Page() {
  return (
    <PageGate>
      <CalendarView />
    </PageGate>
  );
}
