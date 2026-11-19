import { Suspense } from "react";
import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { MyPerformanceView } from "@/components/performance/my-performance-view";

export const metadata: Metadata = { title: "My performance" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <MyPerformanceView />
      </Suspense>
    </PageGate>
  );
}
