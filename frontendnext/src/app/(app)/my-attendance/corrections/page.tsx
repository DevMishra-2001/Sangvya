import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { CorrectionsView } from "@/components/my-attendance/corrections-view";

export const metadata: Metadata = { title: "Attendance corrections" };

export default function Page() {
  return (
    <PageGate>
      <CorrectionsView />
    </PageGate>
  );
}
