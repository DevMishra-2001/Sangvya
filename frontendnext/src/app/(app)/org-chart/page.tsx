import type { Metadata } from "next";
import { Suspense } from "react";
import { OrgChartView } from "@/components/org/org-chart-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Org Chart" };

export default function Page() {
  return (
    <PageGate>
      {/* Reads ?department / ?page from the URL */}
      <Suspense>
        <OrgChartView />
      </Suspense>
    </PageGate>
  );
}
