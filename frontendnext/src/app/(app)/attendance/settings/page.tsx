import { Suspense } from "react";
import type { Metadata } from "next";
import { AttendanceSettingsView } from "@/components/attendance/attendance-settings-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Attendance Settings" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <AttendanceSettingsView />
      </Suspense>
    </PageGate>
  );
}
