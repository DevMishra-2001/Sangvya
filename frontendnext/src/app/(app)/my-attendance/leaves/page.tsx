import type { Metadata } from "next";
import { LeaveApprovalsView } from "@/components/my-attendance/leave-approvals-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Leave Approvals" };

export default function Page() {
  return (
    <PageGate>
      <LeaveApprovalsView />
    </PageGate>
  );
}
