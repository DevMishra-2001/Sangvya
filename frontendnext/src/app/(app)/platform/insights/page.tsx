import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { PlatformInsightsView } from "@/components/platform/platform-insights-view";

export const metadata: Metadata = { title: "Revenue & usage" };

export default function Page() {
  return (
    <PageGate>
      <PlatformInsightsView />
    </PageGate>
  );
}
