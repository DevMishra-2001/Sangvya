import type { Metadata } from "next";
import { AdvanceRequestView } from "@/components/expenses/advance-request-view";
import { PageGate } from "@/components/layout/page-gate";

export const metadata: Metadata = { title: "Advance Request" };

export default function Page() {
  return (
    <PageGate>
      <AdvanceRequestView />
    </PageGate>
  );
}
