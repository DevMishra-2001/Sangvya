import { Suspense } from "react";
import type { Metadata } from "next";
import { LeaveSettingsView } from "@/components/leave/leave-settings-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Leave Settings" };

export default function Page() {
  return (
    <PageGate>
      <Suspense>
        <LeaveSettingsView />
      </Suspense>
    </PageGate>
  );
}
