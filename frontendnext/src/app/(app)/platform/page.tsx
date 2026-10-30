import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { PlatformOverviewView } from "@/components/platform/platform-overview-view";

export const metadata: Metadata = { title: "Platform overview" };

export default function Page() {
  return (
    <PageGate>
      <PlatformOverviewView />
    </PageGate>
  );
}
