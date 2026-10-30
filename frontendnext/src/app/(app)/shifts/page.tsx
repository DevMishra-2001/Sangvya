import type { Metadata } from "next";
import { PageGate } from "@/components/layout/page-gate";
import { ShiftsView } from "@/components/shifts/shifts-view";

export const metadata: Metadata = { title: "Shifts" };

export default function Page() {
  return (
    <PageGate>
      <ShiftsView />
    </PageGate>
  );
}
