import type { Metadata } from "next";
import { ReportView } from "@/components/my-attendance/report-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Attendance Report" };

export default function Page() {
  return (
    <PageGate>
      <ReportView />
    </PageGate>
  );
}
