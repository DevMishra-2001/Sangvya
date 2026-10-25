import type { Metadata } from "next";
import { LeaveView } from "@/components/leave/leave-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Leave" };

export default function Page() {
  return (
    <PageGate>
      <LeaveView />
    </PageGate>
  );
}
