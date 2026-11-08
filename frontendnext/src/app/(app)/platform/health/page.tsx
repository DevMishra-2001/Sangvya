import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { PlatformHealthView } from "@/components/platform/platform-health-view";

export const metadata: Metadata = { title: "System health" };

export default function Page() {
  return (
    <PageGate>
      <PlatformHealthView />
    </PageGate>
  );
}
