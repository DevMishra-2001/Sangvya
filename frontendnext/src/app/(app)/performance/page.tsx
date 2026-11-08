import { Suspense } from "react";
import type { Metadata } from "next";
import { PerformanceView } from "@/components/performance/performance-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Performance Review" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <PerformanceView />
      </Suspense>
    </PageGate>
  );
}
