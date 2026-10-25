import type { Metadata } from "next";
import { LeavePolicyView } from "@/components/leave/leave-policy-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Leave Policy" };

export default function Page() {
  return (
    <PageGate>
      <LeavePolicyView />
    </PageGate>
  );
}
