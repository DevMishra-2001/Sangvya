import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { ReportSettingsView } from "@/components/reports/report-settings-view";

export const metadata: Metadata = { title: "Report settings" };

export default function Page() {
  return (
    <PageGate>
      <ReportSettingsView />
    </PageGate>
  );
}
